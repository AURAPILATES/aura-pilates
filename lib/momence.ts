const BASE_URL = "https://momence.com/_api/primary/api/v1";

async function fetchMomence<T>(endpoint: string): Promise<T> {
  const params = new URLSearchParams({
    hostId: process.env.MOMENCE_HOST_ID ?? "",
    token: process.env.MOMENCE_TOKEN ?? "",
  });
  try {
    const res = await fetch(`${BASE_URL}/${endpoint}?${params}`, {
      next: { revalidate: 300 },
    });
    if (!res.ok) return [] as unknown as T;
    return res.json();
  } catch {
    return [] as unknown as T;
  }
}

export type MomenceEvent = {
  id: number;
  title: string;
  description: string;
  type: string;
  link: string;
  dateTime: string;
  image1: string | null;
  image2: string | null;
  duration: number;
  fixedPrice: number;
  online: boolean;
  location: string;
  isCancelled: boolean;
  isDeleted: boolean;
  allowWaitlist: boolean;
  capacity: number;
  spotsRemaining: number;
  ticketsSold: number;
  published: boolean;
  teacherId: number;
  teacher: string;
  additionalTeachers: string[];
};

export type MomenceTeacher = {
  id: number;
  firstName: string;
  lastName: string;
  bio: string | null;
  profileImage: string | null;
  isDeleted: boolean;
};

export type MomenceMembership = {
  id: number;
  name: string;
  description: string;
  type: "subscription" | "package-events";
  link: string;
  price: number;
  freeTrialExists: boolean;
  isFeatured: boolean;
  isDeleted: boolean;
  isDisabled: boolean;
  isAutoRenewing: boolean;
};

export type MomenceProduct = {
  id: number;
  name: string;
  description: string;
  price: number;
  link: string;
  isDeleted: boolean;
};

export type MomenceVideo = {
  id: number;
  title: string;
  description: string;
  link: string;
  duration: number;
  isDeleted: boolean;
};

export const getEvents = () => fetchMomence<MomenceEvent[]>("Events");
export const getTeachers = () => fetchMomence<MomenceTeacher[]>("Teachers");
export const getMemberships = () => fetchMomence<MomenceMembership[]>("Memberships");
export const getProducts = () => fetchMomence<MomenceProduct[]>("Products");
export const getVideos = () => fetchMomence<MomenceVideo[]>("Videos");
