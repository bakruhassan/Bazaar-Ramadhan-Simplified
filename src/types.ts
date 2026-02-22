export interface Review {
  id: number;
  place_id: string;
  user_name: string;
  rating: number;
  comment: string;
  created_at: string;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  council?: string;
  rating?: number;
  mapsUri: string;
  type: 'bazaar' | 'mosque' | 'transport';
  distance?: string;
  votes?: {
    up: number;
    down: number;
  };
}

export interface GroundingChunk {
  maps?: {
    uri: string;
    title: string;
  };
}

export const OFFICIAL_BAZAARS = [
  {"council": "MPKj", "location": "Bandar Seri Putra", "address": "Jalan Seri Putra 1/3"},
  {"council": "MPKj", "location": "Semenyih", "address": "Jalan TPS 1/1, Taman Pelangi Semenyih"},
  {"council": "DBKL", "location": "TTDI", "address": "Jalan Tun Mohd Fuad 2"},
  {"council": "DBKL", "location": "Kampong Bharu", "address": "Jalan Raja Alang"},
  {"council": "MBSA", "location": "Section 13", "address": "Stadium Shah Alam Parking"},
  {"council": "MBSJ", "location": "USJ 4", "address": "Jalan USJ 4/5 Subang Jaya"},
  {"council": "MBPJ", "location": "Kelana Jaya", "address": "Jalan SS 6/1 Petaling Jaya"},
  {"council": "PPj", "location": "Putrajaya Presint 3", "address": "Dataran Putrajaya"}
];
