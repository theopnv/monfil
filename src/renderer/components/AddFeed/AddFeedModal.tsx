import { useEffect, useState } from "react";
import { Dialog, Modal, ModalOverlay } from "@/components/untitled-ui/application/modals/modal";
import { useAddFeed } from "@/providers/feeds-provider";
import Step1Find, { type FeedKind } from "./Step1Find";
import Step2Configure from "./Step2Configure";
import Step3Done from "./Step3Done";
import { useFeedValidation } from "./useFeedValidation";
import WizardFooter from "./WizardFooter";
import WizardHeader, { type WizardStep } from "./WizardHeader";
import type { AddFeedError } from "../../../main/db/insert";
import type { Feed, FeedCategory } from "../../../preload/channels";

export interface AddFeedModalProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function AddFeedModal({ isOpen, onOpenChange }: AddFeedModalProps) {
  const addFeed = useAddFeed();

  const [step, setStep] = useState<WizardStep>(1);
  const [maxStepReached, setMaxStepReached] = useState<WizardStep>(1);
  const [query, setQuery] = useState("");
  const [kind, setKind] = useState<FeedKind>("anything");
  const [categories, setCategories] = useState<FeedCategory[]>([]);
  const [selectedCategoryName, setSelectedCategoryName] = useState<string | null>(null);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showInHome, setShowInHome] = useState(true);
  const [submitStatus, setSubmitStatus] = useState<"idle" | "loading" | "error">("idle");
  const [submitError, setSubmitError] = useState<AddFeedError | null>(null);
  const [result, setResult] = useState<Feed | null>(null);

  const validation = useFeedValidation(query);

  function resetWizard() {
    setStep(1);
    setMaxStepReached(1);
    setQuery("");
    setKind("anything");
    setSelectedCategoryName(null);
    setNewCategoryName("");
    setShowInHome(true);
    setSubmitStatus("idle");
    setSubmitError(null);
    setResult(null);
  }

  useEffect(() => {
    if (!isOpen) return;
    resetWizard();
    window.electron.ipcRenderer
      .invoke("feeds:list-categories", undefined)
      .then(setCategories)
      .catch(() => setCategories([]));
  }, [isOpen]);

  function goToStep(target: WizardStep) {
    if (target <= maxStepReached) setStep(target);
  }

  function handleContinueFromStep1() {
    if (validation.status !== "found") return;
    setStep(2);
    setMaxStepReached((prev) => (prev < 2 ? 2 : prev));
  }

  function handleAddNewCategory() {
    const name = newCategoryName.trim();
    if (!name) return;
    setSelectedCategoryName(name);
    setNewCategoryName("");
  }

  async function handleSubmit() {
    if (!validation.feed || selectedCategoryName === null) return;
    setSubmitStatus("loading");
    setSubmitError(null);

    const response = await window.electron.ipcRenderer.invoke("feeds:submit-add-feed", {
      link: validation.feed.link,
      title: validation.feed.title,
      items: validation.feed.items,
      categoryName: selectedCategoryName,
      showInHome,
    });

    if (response.success) {
      addFeed(response.data);
      setResult(response.data);
      setSubmitStatus("idle");
      setStep(3);
      setMaxStepReached(3);
    } else {
      setSubmitStatus("error");
      setSubmitError(response.error);
    }
  }

  return (
    <ModalOverlay isOpen={isOpen} onOpenChange={onOpenChange} isDismissable>
      <Modal className="w-full max-w-[680px]">
        <Dialog>
          <WizardHeader step={step} maxStepReached={maxStepReached} onStepClick={goToStep} onClose={() => onOpenChange(false)} />

          {step === 1 && (
            <Step1Find
              query={query}
              onQueryChange={setQuery}
              kind={kind}
              onKindChange={setKind}
              status={validation.status}
              feed={validation.feed}
              error={validation.error}
            />
          )}

          {step === 2 && (
            <Step2Configure
              feed={validation.feed}
              categories={categories}
              selectedCategoryName={selectedCategoryName}
              onSelectCategory={setSelectedCategoryName}
              newCategoryName={newCategoryName}
              onNewCategoryNameChange={setNewCategoryName}
              onAddNewCategory={handleAddNewCategory}
              showInHome={showInHome}
              onShowInHomeChange={setShowInHome}
            />
          )}

          {step === 3 && result && <Step3Done feed={result} />}

          {submitStatus === "error" && submitError && <p className="px-6 pb-2 text-sm text-error-primary">{submitError.message}</p>}

          {step === 1 && (
            <WizardFooter
              primaryLabel="Continue"
              onPrimary={handleContinueFromStep1}
              primaryDisabled={validation.status !== "found"}
              secondaryLabel="Cancel"
              onSecondary={() => onOpenChange(false)}
            />
          )}

          {step === 2 && (
            <WizardFooter
              primaryLabel="Add source"
              onPrimary={handleSubmit}
              primaryDisabled={selectedCategoryName === null}
              primaryLoading={submitStatus === "loading"}
              secondaryLabel="Back"
              onSecondary={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <WizardFooter primaryLabel="Go to feed" onPrimary={() => onOpenChange(false)} secondaryLabel="Add another" onSecondary={resetWizard} />
          )}
        </Dialog>
      </Modal>
    </ModalOverlay>
  );
}
