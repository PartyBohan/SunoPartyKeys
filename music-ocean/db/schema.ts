import {sqliteTable,text,integer,index} from 'drizzle-orm/sqlite-core';
export const creations=sqliteTable('ocean_creations',{
 id:text('id').primaryKey(),owner:text('owner').notNull(),requestKey:text('request_key').notNull(),
 document:text('document').notNull(),createdAt:integer('created_at').notNull(),updatedAt:integer('updated_at').notNull(),
},t=>[index('ocean_owner_created').on(t.owner,t.createdAt)]);
