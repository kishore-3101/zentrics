export type EnvLabel = 'DEMO' | 'LOCAL';

export const ENV_LABEL: EnvLabel =
  import.meta.env.VITE_ENV_LABEL?.toUpperCase() === 'DEMO' ? 'DEMO' : 'LOCAL';

/** Mock data is the default until the backend contract is wired in. */
export const USE_MOCK: boolean = import.meta.env.VITE_USE_MOCK !== 'false';
