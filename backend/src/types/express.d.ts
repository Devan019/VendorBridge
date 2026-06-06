import "express-serve-static-core";

declare module "express-serve-static-core" {
  interface Request {
    user: {
      id: string;
      first_name: string;
      last_name: string;
      name: string;
      email: string;
      role: string;
      phone?: string | null;
      country?: string | null;
      image_url?: string | null;
    };
  }
}

export {};