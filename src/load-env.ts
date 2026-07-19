import { config as loadDotenv } from 'dotenv';

/** Load `.env` before Nest modules evaluate decorator options that call `loadAppConfig()`. */
loadDotenv();
