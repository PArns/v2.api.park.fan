import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	OneToMany,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { Attraction } from './attraction.entity';
import { ParkSchedule } from './park-schedule.entity';
import { ParkGroup } from './park-group.entity';

@Entity('parks')
@Index(['externalId'], { unique: true })
@Index(['parkGroupId', 'name'])
export class Park {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// ThemeParks Wiki ID - for updates and synchronization
	@Column({ name: 'external_id', unique: true })
	externalId!: string;

	@Column()
	name!: string;

	@Column({ nullable: true })
	slug?: string;

	@Column()
	timezone!: string;

	@Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
	latitude?: number;

	@Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
	longitude?: number;

	// Location information
	@Column({ nullable: true })
	country?: string;

	@Column({ nullable: true })
	city?: string;

	@Column({ nullable: true })
	continent?: string;

	@Column({ name: 'country_code', nullable: true, length: 2 })
	countryCode?: string;

	// User-provided website URL for the park
	@Column({ name: 'website', nullable: true })
	website?: string;

	// Multi-language descriptions as JSON: { locale: description }
	@Column({ type: 'jsonb', name: 'descriptions', nullable: true })
	descriptions?: Record<string, string>;

	// Additional metadata
	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	@Column({ name: 'last_synced', nullable: true })
	lastSynced?: Date;

	// Whether the park is at capacity
	@Column({ name: 'is_at_capacity', default: false })
	isAtCapacity!: boolean;

	// Current operating status
	@Column({ name: 'operating_status', nullable: true })
	operatingStatus?: string;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	// Relations
	@Column({ name: 'park_group_id', nullable: true })
	parkGroupId?: string;

	@ManyToOne(() => ParkGroup, (parkGroup) => parkGroup.parks, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'park_group_id' })
	parkGroup?: ParkGroup;

	@OneToMany(() => Attraction, (attraction) => attraction.park)
	attractions!: Attraction[];

	@OneToMany(() => ParkSchedule, (schedule) => schedule.park)
	schedules!: ParkSchedule[];
}
