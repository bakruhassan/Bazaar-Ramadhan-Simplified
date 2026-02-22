import { GoogleGenAI } from "@google/genai";
import { Place } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

const getAuthHeader = () => {
  const token = localStorage.getItem('token');
  return token ? { 'Authorization': `Bearer ${token}` } : {};
};

export async function login(email, password) {
  const res = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function signup(username, email, password) {
  const res = await fetch("/api/auth/signup", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ username, email, password }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMe() {
  const res = await fetch("/api/auth/me", {
    headers: getAuthHeader(),
  });
  if (!res.ok) return null;
  return res.json();
}

export async function subscribe(placeId) {
  const res = await fetch("/api/subscribe", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify({ place_id: placeId }),
  });
  return res.json();
}

export async function getNotifications() {
  const res = await fetch("/api/notifications", {
    headers: getAuthHeader(),
  });
  if (!res.ok) return [];
  return res.json();
}

export async function markNotificationsRead() {
  const res = await fetch("/api/notifications/read", {
    method: "POST",
    headers: getAuthHeader(),
  });
  return res.json();
}

export async function searchPlaces(query: string, lat?: number, lng?: number): Promise<Place[]> {
  const model = "gemini-2.5-flash"; // Required for googleMaps
  
  const response = await ai.models.generateContent({
    model,
    contents: `Find ${query} near this location. Return the results as a list of places with their names and addresses.`,
    config: {
      tools: [{ googleMaps: {} }],
      toolConfig: {
        retrievalConfig: {
          latLng: lat && lng ? { latitude: lat, longitude: lng } : undefined
        }
      }
    },
  });

  const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
  
  // Extract places from grounding chunks
  const places: Place[] = chunks
    .filter(chunk => chunk.maps?.uri)
    .map((chunk, index) => {
      const name = chunk.maps?.title || "Unknown Place";
      return {
        id: `place-${name.replace(/\s+/g, '-').toLowerCase()}-${index}`,
        name: name,
        address: "", // Gemini doesn't always provide address in the chunk itself, but the URI is key
        mapsUri: chunk.maps?.uri || "",
        type: query.toLowerCase().includes('bazaar') ? 'bazaar' : 
              query.toLowerCase().includes('mosque') ? 'mosque' : 'transport'
      };
    });

  return places;
}

export async function getVotes(placeId: string) {
  const res = await fetch(`/api/votes/${encodeURIComponent(placeId)}`);
  return res.json();
}

export async function submitVote(placeId: string, voteType: number, fingerprint: string) {
  const res = await fetch("/api/votes", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ place_id: placeId, vote_type: voteType, user_fingerprint: fingerprint }),
  });
  return res.json();
}

export async function getReviews(placeId: string) {
  const res = await fetch(`/api/reviews/${encodeURIComponent(placeId)}`);
  return res.json();
}

export async function addReview(review: { place_id: string; rating: number; comment: string }) {
  const res = await fetch("/api/reviews", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeader() },
    body: JSON.stringify(review),
  });
  return res.json();
}
