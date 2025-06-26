import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { Attraction } from './attraction.entity';

// Import enum from attraction entity
export enum OperatingStatus {
	OPERATING = 'OPERATING',
	DOWN = 'DOWN',
	CLOSED = 'CLOSED',
	REFURBISHMENT = 'REFURBISHMENT',
	TEMPORARILY_CLOSED = 'TEMPORARILY_CLOSED',
}

export enum QueueType {
	STANDBY = 'STANDBY',
	RETURN_TIME = 'RETURN_TIME',
	PAID_RETURN_TIME = 'PAID_RETURN_TIME',
	LIGHTNING_LANE = 'LIGHTNING_LANE',
	FAST_PASS = 'FAST_PASS',
	SINGLE_RIDER = 'SINGLE_RIDER',
}

@Entity('wait_times')
// Composite index to quickly find wait-times per attraction and queue type in chronological order
@Index(['attractionId', 'queueType', 'recordedAt'])
// Index on recordedAt for efficient time range queries
@Index('IDX_wait_times_recorded_at', ['recordedAt'])
// Index on status for filtering by operating status
@Index('IDX_wait_times_status', ['status'])
// Index on isActive for active/inactive filtering - MOST IMPORTANT for current data
@Index('IDX_wait_times_is_active', ['isActive'])
// Optimized index for current wait times per attraction and queue type
@Index('IDX_wait_times_current', ['attractionId', 'queueType', 'isActive', 'recordedAt'])
export class WaitTime {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'wait_time_minutes', nullable: true })
	waitTimeMinutes?: number;

	@Column({
		type: 'enum',
		enum: QueueType,
		name: 'queue_type',
		default: QueueType.STANDBY,
	})
	queueType!: QueueType;

	@Column({
		type: 'enum',
		enum: OperatingStatus,
	})
	status!: OperatingStatus;

	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	@Column({ name: 'recorded_at' })
	recordedAt!: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	// Relations
	@Column({ name: 'attraction_id' })
	attractionId!: string;

	@ManyToOne(() => Attraction, (attraction) => attraction.waitTimes, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'attraction_id' })
	attraction!: Attraction;
}
