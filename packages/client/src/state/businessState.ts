import type {
  Business,
  BusinessPost,
  Citizen,
  Employee,
  EmployeeValue,
  RegisteredVehicle,
} from "@snailycad/types";
import create from "zustand";

export type FullEmployee = Employee & {
  citizen: Pick<Citizen, "id" | "name" | "surname">;
  role: EmployeeValue;
};
export type FullBusiness = Business & {
  employees: FullEmployee[];
  citizen: Pick<Citizen, "id" | "name" | "surname">;
  businessPosts: BusinessPost[];
  vehicles: RegisteredVehicle[];
};

interface BusinessState {
  currentBusiness: FullBusiness | null;
  setCurrentBusiness(bus: FullBusiness | null): void;

  currentEmployee: FullEmployee | null;
  setCurrentEmployee(em: FullEmployee | null): void;

  posts: BusinessPost[];
  setPosts(posts: BusinessPost[]): void;

  joinableBusinesses: Business[];
  setJoinableBusinesses(businesses: Business[]): void;
}

export const useBusinessState = create<BusinessState>((set) => ({
  currentBusiness: null,
  setCurrentBusiness: (business) => set({ currentBusiness: business }),

  currentEmployee: null,
  setCurrentEmployee: (employee) => set({ currentEmployee: employee }),

  posts: [],
  setPosts: (posts) => set({ posts }),

  joinableBusinesses: [],
  setJoinableBusinesses: (businesses) => set({ joinableBusinesses: businesses }),
}));
