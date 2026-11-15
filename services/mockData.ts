import { Driver, Ride, RideStatus, UserRole, PaymentMethod, VehicleType } from "../types";

export const MOCK_PASSENGER = {
  id: 'u1',
  name: 'Ahmed Ali',
  phone: '+20123456789',
  role: UserRole.PASSENGER,
  rating: 4.8,
  avatar: 'https://picsum.photos/100/100?random=1'
};

export const MOCK_DRIVER: Driver = {
  id: 'd1',
  name: 'Karim Mahmoud',
  phone: '+20198765432',
  role: UserRole.DRIVER,
  rating: 4.9,
  avatar: 'https://picsum.photos/100/100?random=2',
  vehicleBrand: 'Toyota',
  vehicleType: 'Mowasla X',
  vehicleModel: 'Corolla',
  vehicleYear: '2022',
  vehiclePlate: 'ABC 123',
  vehicleColor: 'Silver',
  vehicleImageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/d3/2019_Toyota_Corolla_Icon_Tech_HEV_CVT_1.8.jpg/640px-2019_Toyota_Corolla_Icon_Tech_HEV_CVT_1.8.jpg',
  licenseNumber: 'DL-123456789',
  isOnline: false,
  currentLocation: { lat: 30.0444, lng: 31.2357 },
  earnings: 1250.50,
  totalRides: 342
};

export const MOCK_NEARBY_DRIVERS = [
  { id: 'd2', lat: 30.045, lng: 31.236 },
  { id: 'd3', lat: 30.043, lng: 31.234 },
  { id: 'd4', lat: 30.046, lng: 31.238 },
];

export const MOCK_RIDE_HISTORY: Ride[] = [
  {
    id: 'r_prev_1',
    passengerId: 'u1',
    driverId: 'd5',
    pickup: { address: 'Cairo Festival City', coords: { lat: 0, lng: 0 } },
    dropoff: { address: 'Maadi City Center', coords: { lat: 0, lng: 0 } },
    status: RideStatus.COMPLETED,
    fare: 85.00,
    distanceValue: 12.5,
    distanceText: '12.5 km',
    durationText: '25 min',
    timestamp: Date.now() - 86400000,
    createdAt: new Date().toISOString(),
    paymentMethod: PaymentMethod.CASH,
    requestedVehicleType: VehicleType.STANDARD
  },
  {
    id: 'r_prev_2',
    passengerId: 'u1',
    driverId: 'd6',
    pickup: { address: 'Zamalek', coords: { lat: 0, lng: 0 } },
    dropoff: { address: 'Downtown', coords: { lat: 0, lng: 0 } },
    status: RideStatus.COMPLETED,
    fare: 45.00,
    distanceValue: 4.2,
    distanceText: '4.2 km',
    durationText: '15 min',
    timestamp: Date.now() - 172800000,
    createdAt: new Date().toISOString(),
    paymentMethod: PaymentMethod.WALLET,
    requestedVehicleType: VehicleType.COMFORT
  }
];