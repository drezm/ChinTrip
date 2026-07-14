export type TravelerId = 'traveler-a' | 'traveler-b' | 'traveler-c'
export type Currency = 'CNY' | 'RUB'
export type PlaceCategory = 'sight' | 'food' | 'shopping'
export type PlaceStatus = 'want' | 'done'
export type TicketKind = 'flight' | 'train' | 'metro-pass'
export type DayItemKind = 'place' | 'hotel' | 'ticket' | 'note'
export type ChecklistKind = 'notes' | 'packing' | 'visa' | 'phrases'

export interface Traveler {
  id: TravelerId
  name: string
  color: string
  sortOrder: number
}

export interface Place {
  id: string
  name: string
  city: string
  category: PlaceCategory
  url: string
  note: string
  photoUrl: string
  status: PlaceStatus
  dayId?: string
  createdAt: string
}

export interface Hotel {
  id: string
  name: string
  city: string
  address: string
  checkIn: string
  checkOut: string
  price: number
  currency: Currency
  url: string
  confirmationUrl: string
  note: string
}

export interface Ticket {
  id: string
  kind: TicketKind
  fromCity: string
  toCity: string
  departAt: string
  arriveAt: string
  refNumber: string
  seat: string
  price: number
  currency: Currency
  url: string
  fileUrl: string
}

export interface Day {
  id: string
  date: string
  city: string
  note: string
}

export interface DayItem {
  id: string
  dayId: string
  kind: DayItemKind
  refId: string
  sortOrder: number
  title?: string
  note?: string
}

export interface Expense {
  id: string
  payerId: TravelerId
  amount: number
  currency: Currency
  category: string
  description: string
  spentAt: string
  createdAt: string
}

export interface ExpenseShare {
  expenseId: string
  travelerId: TravelerId
}

export interface Checklist {
  id: string
  title: string
  kind: ChecklistKind
}

export interface ChecklistItem {
  id: string
  checklistId: string
  text: string
  done: boolean
  sortOrder: number
}

export interface Settings {
  cnyToRubRate: number
  rateUpdatedAt: string
  displayCurrency: Currency
}

export interface TripState {
  travelers: Traveler[]
  places: Place[]
  hotels: Hotel[]
  tickets: Ticket[]
  days: Day[]
  dayItems: DayItem[]
  expenses: Expense[]
  expenseShares: ExpenseShare[]
  checklists: Checklist[]
  checklistItems: ChecklistItem[]
  settings: Settings
}

export interface Settlement {
  fromId: TravelerId
  toId: TravelerId
  amountCny: number
}

export interface TravelerBalance {
  travelerId: TravelerId
  balanceCny: number
}
