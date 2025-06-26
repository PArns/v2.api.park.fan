// Enums for type safety
export enum EntityType {
	PARK = 'PARK',
	ATTRACTION = 'ATTRACTION',
	SHOW = 'SHOW',
	RESTAURANT = 'RESTAURANT',
	SHOP = 'SHOP',
	MEET_AND_GREET = 'MEET_AND_GREET',
	EXPERIENCE = 'EXPERIENCE',
	OTHER = 'OTHER',
}

export enum OperatingStatus {
	OPERATING = 'OPERATING',
	DOWN = 'DOWN',
	CLOSED = 'CLOSED',
	REFURBISHMENT = 'REFURBISHMENT',
	TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
}

export enum ParkScheduleType {
	OPERATING = 'OPERATING',
	CLOSED = 'CLOSED',
	SPECIAL_HOURS = 'SPECIAL_HOURS',
	PRIVATE_EVENT = 'PRIVATE_EVENT',
	TICKETED_EVENT = 'TICKETED_EVENT',
	INFO = 'INFO',
}

export enum ShowType {
	REGULAR = 'REGULAR',
	SPECIAL = 'SPECIAL',
	SEASONAL = 'SEASONAL',
	FIREWORKS = 'FIREWORKS',
	PARADE = 'PARADE',
}

export enum QueueType {
	STANDBY = 'STANDBY',
	RETURN_TIME = 'RETURN_TIME',
	PAID_RETURN_TIME = 'PAID_RETURN_TIME',
	LIGHTNING_LANE = 'LIGHTNING_LANE',
	FAST_PASS = 'FAST_PASS',
	SINGLE_RIDER = 'SINGLE_RIDER',
}

export enum PurchaseType {
	PACKAGE = 'PACKAGE',
	ATTRACTION = 'ATTRACTION',
}

export enum ShowTimeType {
	OPERATING = 'Operating',
	PERFORMANCE_TIME = 'Performance Time',
	SPECIAL = 'Special',
	PARADE = 'Parade',
	FIREWORKS = 'Fireworks',
}

export interface LocationDto {
	latitude?: number | null;
	longitude?: number | null;
}

export interface PriceDto {
	amount: number;
	currency: string;
	formatted: string;
}

export interface PurchaseDto {
	id: string;
	name: string;
	type: PurchaseType;
	price?: PriceDto;
	available: boolean;
}

export interface QueueDto {
	type: QueueType;
	waitTime?: number | null;
}

export interface ParkGroupDto {
	id: string;
	name: string;
	parks: ParkDto[];
}

export interface ParkDto {
	id: string;
	name: string;
	timezone?: string;
	location?: LocationDto;
	entityType?: EntityType;
	parentId?: string;
	destinationId?: string;
	externalId?: string;
}

export interface AttractionDto {
	id: string;
	name: string;
	entityType: EntityType;
	parkId: string;
	externalId?: string;
	status?: OperatingStatus;
	waitTime?: number;
	lastUpdated?: string;
	location?: LocationDto;
	queue?: Record<QueueType, { waitTime?: number | null }>;
}

export interface WaitTimeDto {
	id: string;
	waitTime?: number | null;
	status?: OperatingStatus;
	lastUpdated?: string;
	queueType?: QueueType;
	attractionId?: string;
}

export interface ShowTimeDto {
	id: string;
	name: string;
	showtimes: Array<{
		startTime: string;
		endTime: string;
		type?: ShowTimeType;
	}>;
	lastUpdated?: string;
}

export interface RestaurantDto {
	id: string;
	name: string;
	entityType: EntityType;
	parkId: string;
	externalId?: string;
	location?: LocationDto;
	lastUpdated?: string;
}

export interface EntityDto {
	id: string;
	name: string;
	entityType: EntityType;
	parkId?: string;
	externalId?: string;
	location?: LocationDto;
	lastUpdated?: string;
	// For attractions
	status?: OperatingStatus;
	waitTime?: number;
	queue?: Record<QueueType, { waitTime?: number | null }>;
	// For shows
	showtimes?: Array<{
		startTime: string;
		endTime: string;
		type?: ShowTimeType;
	}>;
}

export interface ParkScheduleDto {
	date: string;
	type: ParkScheduleType;
	openingTime?: string;
	closingTime?: string;
	description?: string;
	purchases?: PurchaseDto[];
}

export interface ApiResponseDto<T> {
	data: T;
	lastUpdated?: string;
	ttl?: number;
}

// API Response Interfaces for ThemeParks Wiki API
export interface ThemeParksDestinationsResponse {
	destinations: Array<{
		id: string;
		name: string;
		slug: string;

		parks: Array<{
			id: string;
			name: string;
		}>;
	}>;
}

export interface ThemeParksEntityResponse {
	id: string;
	name: string;
	slug?: string;
	location?: {
		latitude?: number;
		longitude?: number;
	};
	timezone?: string;
	entityType?: EntityType;
	externalId?: string;
	parentId?: string; // Only for parks
	destinationId?: string; // Only for parks
}

export interface ThemeParksChildrenResponse {
	id: string;
	name: string;
	entityType: EntityType;
	timezone?: string;
	children: Array<{
		id: string;
		name: string;
		entityType: EntityType;
		slug?: string | null;
		parentId: string;
		externalId?: string;
		location?: {
			latitude?: number | null;
			longitude?: number | null;
		};
	}>;
}

export interface ThemeParksLiveDataResponse {
	id: string;
	name: string;
	entityType: EntityType;
	timezone?: string;
	liveData: Array<{
		id: string;
		name: string;
		entityType: EntityType;
		parkId: string;
		externalId?: string;
		status?: OperatingStatus;
		queue?: Record<QueueType, { waitTime?: number | null }>;
		showtimes?: Array<{
			startTime: string;
			endTime: string;
			type?: ShowTimeType;
		}>;
		lastUpdated?: string;
	}>;
}

export interface ThemeParksScheduleResponse {
	id: string;
	name: string;
	entityType: EntityType;
	timezone?: string;
	schedule: Array<{
		date: string;
		type: ParkScheduleType;
		openingTime?: string;
		closingTime?: string;
		description?: string;
		purchases?: Array<{
			id: string;
			name: string;
			type: PurchaseType;
			price?: {
				amount: number;
				currency: string;
				formatted: string;
			};
			available: boolean;
		}>;
	}>;
}
