export type SqlDatabase = {
  healthCheck(): Promise<void>;
  transaction<T>(work: () => Promise<T>): Promise<T>;
};
