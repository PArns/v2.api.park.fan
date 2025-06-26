import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { Restaurant } from './restaurant.entity';

@Entity('restaurant_history')
// Index for efficient historical queries
@Index(['restaurantId', 'recordedAt'])
@Index(['recordedAt']) // For time-range queries
@Index(['availabilityStatus', 'recordedAt']) // For availability analytics
@Index(['acceptsReservations', 'recordedAt']) // For reservation analytics
@Index(['restaurantId', 'isActive', 'recordedAt']) // For current data lookup
export class RestaurantHistory {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// Historical snapshot data
	@Column()
	name!: string;

	@Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
	latitude?: number;

	@Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
	longitude?: number;

	@Column({ name: 'is_active_restaurant', default: false })
	isActiveRestaurant!: boolean;

	// Restaurant-specific status (available/full/closed)
	@Column({ name: 'availability_status', nullable: true })
	availabilityStatus?: string;

	// If the restaurant accepts reservations
	@Column({ name: 'accepts_reservations', default: false })
	acceptsReservations!: boolean;

	// Track if this is the current/active record
	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	// When this data was recorded
	@Column({ name: 'recorded_at' })
	recordedAt!: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	// Relations
	@Column({ name: 'restaurant_id' })
	restaurantId!: string;

	@ManyToOne(() => Restaurant, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'restaurant_id' })
	restaurant!: Restaurant;
}
