---
title: تثبيت Monfil
description: نزّل Monfil وثبّته على macOS أو Windows أو Linux.
---

Monfil مجاني. اختر نظامك:

- [macOS](#macos)
- [Windows](#windows)
- [Linux](#linux)

## macOS

يلزم macOS 13 Ventura أو أحدث. لمعرفة الشريحة في جهاز Mac، افتح قائمة Apple واختر **About This Mac**. انظر إلى السطر **Chip** أو **Processor**.

1. نزّل الملف المناسب لشريحتك من أحدث إصدار:
   - شريحة Apple silicon (يبدأ السطر بكلمة **Apple**): [`monfil-macos-arm64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-arm64.dmg)
   - Intel (يبدأ السطر بكلمة **Intel**): [`monfil-macos-x64.dmg`](https://github.com/theopnv/monfil/releases/latest/download/monfil-macos-x64.dmg)
2. افتح الملف المنزّل. تظهر نافذة فيها أيقونة Monfil ومجلد Applications.
3. اسحب أيقونة Monfil إلى مجلد Applications.
4. أغلق النافذة، ثم اقذف قرص Monfil من الشريط الجانبي في Finder.
5. افتح Monfil من مجلد Applications أو من Launchpad.

فحصت Apple هذا الإصدار من Monfil، لذلك يفتحه macOS دون تحذير أمني.

يحدّث Monfil نفسه. عندما يصبح إصدار جديد جاهزًا، تظهر رسالة فيها زر **Restart**. اضغط **Restart** لإكمال التحديث. تعمل التحديثات فقط عندما تفتح Monfil من مجلد Applications.

## Windows

يعمل Monfil على Windows 10 وWindows 11.

### Microsoft Store (موصى به)

1. افتح [Monfil في Microsoft Store](https://apps.microsoft.com/detail/9P4FZNFBR29Q).
2. اضغط **Get** أو **Install**.
3. افتح Monfil من قائمة ابدأ.

يحافظ Store على تحديث Monfil.

يمكنك أيضًا تثبيت نسخة Store من الطرفية باستخدام winget:

```sh
winget install --id 9P4FZNFBR29Q --source msstore
```

### ملف الإعداد

استخدم هذا الخيار إذا كنت لا تستطيع استخدام Microsoft Store.

1. افتح [أحدث إصدار من Monfil](https://github.com/theopnv/monfil/releases/latest).
2. ضمن **Assets**، نزّل الملف الذي ينتهي بـ `Setup.exe`.
3. افتح الملف المنزّل. يُثبَّت Monfil ويفتح.

قد يعرض Windows الرسالة **Windows protected your PC**، لأن هذا الملف لا يحمل توقيعًا مدفوعًا. اضغط **More info**، ثم **Run anyway**. لا تعرض نسخة Store هذه الرسالة.

يحدّث Monfil نفسه. عندما يصبح إصدار جديد جاهزًا، تظهر رسالة فيها زر **Restart**. اضغط **Restart** لإكمال التحديث.

## Linux

يعمل Monfil على أجهزة Intel وAMD ذات معالج 64 بت.

1. افتح [أحدث إصدار من Monfil](https://github.com/theopnv/monfil/releases/latest).
2. ضمن **Assets**، نزّل الملف المناسب لنظامك:
    - على Debian أو Ubuntu أو Linux Mint، الملف الذي ينتهي بـ `.deb`.
    - على Fedora أو RHEL أو openSUSE، الملف الذي ينتهي بـ `.rpm`.
3. افتح الملف المنزّل ببرنامج التثبيت في متجر البرامج، أو ثبّته من الطرفية داخل مجلد التنزيلات:
    - على Debian أو Ubuntu أو Linux Mint: `sudo apt install ./monfil_*.deb`
    - على Fedora أو RHEL: `sudo dnf install ./monfil-*.rpm`
4. افتح Monfil من قائمة التطبيقات.

لا يحدّث Monfil نفسه على Linux. للتحديث، نزّل الملف الجديد من أحدث إصدار وثبّته.

## هل Monfil آمن؟

شيفرة Monfil عامة، ويستطيع أي شخص قراءتها. يبني GitHub كل إصدار من تلك الشيفرة عبر [سير عمل عام](https://github.com/theopnv/monfil/blob/main/.github/workflows/publish.yml).

## الخطوة التالية

اتبع [استخدام Monfil](../home/) لإضافة موجزات وإعداد ووركسبيس.
