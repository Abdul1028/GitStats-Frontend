import NextAuth from "next-auth";

declare module "next-auth" {
  interface Session {
    accessToken?: string;
    // add other custom properties if needed
  }
  interface User {
    accessToken?: string;
  }
} 