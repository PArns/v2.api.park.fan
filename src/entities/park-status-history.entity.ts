import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { Park } from './park.entity';

@Entity('park_status_history')
// Index for efficient historical queries
@Index(['parkId', 'recordedAt'])
@Index(['recordedAt']) // For time-range queries
@Index(['isAtCapacity', 'recordedAt']) // For capacity analytics
@Index(['operatingStatus', 'recordedAt']) // For operational analytics
@Index(['parkId', 'isActive', 'recordedAt']) // For current data lookup
export class ParkStatusHistory {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// Whether the park is at capacity
	@Column({ name: 'is_at_capacity', default: false })
	isAtCapacity!: boolean;

	// Current operating status
	@Column({ name: 'operating_status', nullable: true })
	operatingStatus?: string;

	// Calculated metrics
	@Column({ name: 'avg_wait_time', nullable: true })
	avgWaitTime?: number;

	@Column({ name: 'max_wait_time', nullable: true })
	maxWaitTime?: number;

	@Column({ name: 'total_attractions_open', nullable: true })
	totalAttractionsOpen?: number;

	@Column({ name: 'total_attractions_closed', nullable: true })
	totalAttractionsClosed?: number;

	// Track if this is the current/active record
	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	// When this data was recorded
	@Column({ name: 'recorded_at' })
	recordedAt!: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	// Relations
	@Column({ name: 'park_id' })
	parkId!: string;

	@ManyToOne(() => Park, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'park_id' })
	park!: Park;
}
