export type TravelerId = string
export type Currency = 'CNY' | 'RUB'
export type PlaceCategory = string
export type PlaceStatus = 'want' | 'done'
export type TicketKind = 'flight' | 'train' | 'metro-pass'
export type DayItemKind = 'place' | 'hotel' | 'ticket' | 'note'
export type ChecklistKind = 'notes' | 'packing' | 'visa' | 'phrases'
export type ExpenseSplitType = 'equal' | 'exact' | 'percentage'
export type PaymentStatus = 'planned' | 'completed'
export type ThemeMode = 'light' | 'dark' | 'system'

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
  updatedAt?: string
}

export interface PlaceSection {
  id: string
  title: string
  sortOrder: number
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
  createdAt?: string
  updatedAt?: string
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
  createdAt?: string
  updatedAt?: string
}

export interface Day {
  id: string
  date: string
  city: string
  note: string
  createdAt?: string
  updatedAt?: string
}

export interface DayItem {
  id: string
  dayId: string
  kind: DayItemKind
  refId: string
  sortOrder: number
  title?: string
  note?: string
  createdAt?: string
  updatedAt?: string
}

export interface Expense {
  id: string
  payerId: TravelerId
  amount: number
  currency: Currency
  exchangeRate: number
  amountCny: number
  splitType: ExpenseSplitType
  category: string
  description: string
  spentAt: string
  dayId?: string
  placeId?: string
  hotelId?: string
  ticketId?: string
  createdBy: TravelerId
  createdAt?: string
  updatedAt?: string
}

export interface ExpenseSplit {
  id: string
  expenseId: string
  travelerId: TravelerId
  value: number
  amountCny: number
}

export interface ExpenseShare {
  expenseId: string
  travelerId: TravelerId
}

export interface Payment {
  id: string
  fromTravelerId: TravelerId
  toTravelerId: TravelerId
  amount: number
  currency: Currency
  exchangeRate: number
  amountCny: number
  status: PaymentStatus
  paidAt?: string
  note: string
  createdAt?: string
  updatedAt?: string
}

export interface Checklist {
  id: string
  title: string
  kind: ChecklistKind
  createdAt?: string
  updatedAt?: string
}

export interface ChecklistItem {
  id: string
  checklistId: string
  text: string
  done: boolean
  sortOrder: number
  createdAt?: string
  updatedAt?: string
}

export interface Settings {
  cnyToRubRate: number
  rateUpdatedAt: string
  displayCurrency: Currency
  theme: ThemeMode
}

export interface TripState {
  travelers: Traveler[]
  placeSections: PlaceSection[]
  places: Place[]
  hotels: Hotel[]
  tickets: Ticket[]
  days: Day[]
  dayItems: DayItem[]
  expenses: Expense[]
  expenseShares: ExpenseShare[]
  expenseSplits: ExpenseSplit[]
  payments: Payment[]
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
  paidCny: number
  owedCny: number
  paymentDeltaCny: number
  balanceCny: number
}

export interface ServerError {
  code: string
  message: string
  fieldErrors?: Record<string, string[]>
}
