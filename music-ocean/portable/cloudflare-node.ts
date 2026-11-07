import {createStorage} from './storage';
export const storage=createStorage(process.env.OCEAN_DATA_DIR||'.ocean-data');
export const env={...process.env,DB:storage.DB,BUCKET:storage.BUCKET};
