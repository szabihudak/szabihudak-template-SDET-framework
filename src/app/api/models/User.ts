export type TestUser = {
  name: string;
  email: string;
  password: string;
};

export type AuthenticatedUser = TestUser & {
  accessToken: string;
};
