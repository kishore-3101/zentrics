export type EnvLabel = 'DEMO' | 'LOCAL';

export const ENV_LABEL: EnvLabel =
  import.meta.env.VITE_ENV_LABEL?.toUpperCase() === 'DEMO' ? 'DEMO' : 'LOCAL';

/** Connect strictly to live backend and database. */
export const USE_MOCK: boolean = false;
