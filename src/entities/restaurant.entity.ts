import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';

@Entity('restaurants')
@Index(['externalId'], { unique: true })
@Index(['parkId', 'name'])
@Index(['parkId', 'isActive'])
export class Restaurant {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// ThemeParks Wiki ID - for updates and synchronization
	@Column({ name: 'external_id', unique: true })
	externalId!: string;

	@Column()
	name!: string;

	// URL-friendly slug generated from name
	@Column({ nullable: true })
	slug?: string;

	@Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
	latitude?: number;

	@Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
	longitude?: number;

	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	// Restaurant-specific status (available/full/closed)
	@Column({ name: 'availability_status', nullable: true })
	availabilityStatus?: string;

	// If the restaurant accepts reservations
	@Column({ name: 'accepts_reservations', default: false })
	acceptsReservations!: boolean;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@Column({ name: 'last_synced', nullable: true })
	lastSynced?: Date;

	// Relations
	@Column({ name: 'park_id' })
	parkId!: string;
}
