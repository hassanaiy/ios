// This service provides a curated list of car brands and models with representative images.
// Images are sourced from reliable public URLs (Unsplash) for demonstration.

export interface CarModel {
  name: string;
  image: string;
}

export interface CarBrand {
  name: string;
  logo?: string;
  models: CarModel[];
}

export const CAR_DATABASE: CarBrand[] = [
  {
    name: "Toyota",
    models: [
      { name: "Corolla", image: "https://images.unsplash.com/photo-1590362891991-f776e747a588?auto=format&fit=crop&w=600&q=80" },
      { name: "Camry", image: "https://images.unsplash.com/photo-1626077388041-33311f823272?auto=format&fit=crop&w=600&q=80" },
      { name: "Yaris", image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=600&q=80" },
      { name: "Fortuner", image: "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=600&q=80" }, // Generic SUV
      { name: "C-HR", image: "https://images.unsplash.com/photo-1632243292440-b2149e37c569?auto=format&fit=crop&w=600&q=80" }
    ]
  },
  {
    name: "Hyundai",
    models: [
      { name: "Elantra", image: "https://images.unsplash.com/photo-1624504107775-816b677d2422?auto=format&fit=crop&w=600&q=80" },
      { name: "Tucson", image: "https://images.unsplash.com/photo-1588636162492-5983e30bc130?auto=format&fit=crop&w=600&q=80" }, 
      { name: "Accent", image: "https://images.unsplash.com/photo-1549317661-bd32c8ce0db2?auto=format&fit=crop&w=600&q=80" },
      { name: "Creta", image: "https://images.unsplash.com/photo-1609521263047-f8f205293f24?auto=format&fit=crop&w=600&q=80" }
    ]
  },
  {
    name: "Kia",
    models: [
      { name: "Cerato / Forte", image: "https://images.unsplash.com/photo-1596711682307-e836b8c8d8c3?auto=format&fit=crop&w=600&q=80" },
      { name: "Sportage", image: "https://images.unsplash.com/photo-1562911791-c7a97b729ec5?auto=format&fit=crop&w=600&q=80" },
      { name: "Rio", image: "https://images.unsplash.com/photo-1628882098045-8c7a6b0c2a26?auto=format&fit=crop&w=600&q=80" }
    ]
  },
  {
    name: "Nissan",
    models: [
      { name: "Sunny", image: "https://images.unsplash.com/photo-1617788138017-80ad40651399?auto=format&fit=crop&w=600&q=80" },
      { name: "Qashqai", image: "https://images.unsplash.com/photo-1614205836904-8025287e07c2?auto=format&fit=crop&w=600&q=80" },
      { name: "Sentra", image: "https://images.unsplash.com/photo-1605218427306-633ba301132b?auto=format&fit=crop&w=600&q=80" }
    ]
  },
  {
    name: "Chevrolet",
    models: [
      { name: "Optra", image: "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=600&q=80" },
      { name: "Aveo", image: "https://images.unsplash.com/photo-1625055172932-a6369796e62c?auto=format&fit=crop&w=600&q=80" },
      { name: "Cruze", image: "https://images.unsplash.com/photo-1606016159991-dfe4f2746ad5?auto=format&fit=crop&w=600&q=80" }
    ]
  },
  {
    name: "Mercedes-Benz",
    models: [
      { name: "C-Class", image: "https://images.unsplash.com/photo-1618843479313-40f8afb4b4d8?auto=format&fit=crop&w=600&q=80" },
      { name: "E-Class", image: "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=600&q=80" },
      { name: "S-Class", image: "https://images.unsplash.com/photo-1620882352554-18bd11d33116?auto=format&fit=crop&w=600&q=80" }
    ]
  },
  {
    name: "BMW",
    models: [
      { name: "3 Series", image: "https://images.unsplash.com/photo-1555215695-3004980adade?auto=format&fit=crop&w=600&q=80" },
      { name: "5 Series", image: "https://images.unsplash.com/photo-1556189250-72ba95452242?auto=format&fit=crop&w=600&q=80" },
      { name: "X3", image: "https://images.unsplash.com/photo-1580273916550-e323be2ed532?auto=format&fit=crop&w=600&q=80" }
    ]
  },
  {
    name: "BYD",
    models: [
       { name: "F3", image: "https://images.unsplash.com/photo-1502877338535-766e1452684a?auto=format&fit=crop&w=600&q=80" } // Generic Sedan Proxy
    ]
  },
  {
    name: "Geely",
    models: [
       { name: "Emgrand", image: "https://images.unsplash.com/photo-1626859218524-747683d463b8?auto=format&fit=crop&w=600&q=80" } 
    ]
  }
];