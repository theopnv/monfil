// As per https://kysely.dev/docs/migrations, migrations are typed against Kysely<any>.
/* eslint-disable @typescript-eslint/no-explicit-any */
import type { Kysely } from 'kysely';

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('feedItem')
    .addColumn('read_at', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('feedItem')
    .dropColumn('read_at')
    .execute();
}
