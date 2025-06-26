import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { Attraction, EntityType, OperatingStatus } from './attraction.entity';

@Entity('attraction_history')
// Index for efficient historical queries
@Index(['attractionId', 'recordedAt'])
@Index(['recordedAt']) // For time-range queries
@Index(['status', 'recordedAt']) // For status analytics
@Index(['entityType', 'status', 'recordedAt']) // For entity type analytics
@Index(['attractionId', 'isActive', 'recordedAt']) // For current data lookup
export class AttractionHistory {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// Historical snapshot data
	@Column()
	name!: string;

	@Column({
		type: 'enum',
		enum: EntityType,
		name: 'entity_type',
	})
	entityType!: EntityType;

	@Column({
		type: 'enum',
		enum: OperatingStatus,
		nullable: true,
	})
	status?: OperatingStatus;

	@Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
	latitude?: number;

	@Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
	longitude?: number;

	@Column({ name: 'is_active_attraction', default: false })
	isActiveAttraction!: boolean;

	// Track if this is the current/active record
	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	// When this data was recorded
	@Column({ name: 'recorded_at' })
	recordedAt!: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	// Relations
	@Column({ name: 'attraction_id' })
	attractionId!: string;

	@ManyToOne(() => Attraction, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'attraction_id' })
	attraction!: Attraction;
}
