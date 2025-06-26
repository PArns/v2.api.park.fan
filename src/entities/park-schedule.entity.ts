import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { Park } from './park.entity';

export enum ParkScheduleType {
	OPERATING = 'OPERATING',
	CLOSED = 'CLOSED',
	SPECIAL_HOURS = 'SPECIAL_HOURS',
	PRIVATE_EVENT = 'PRIVATE_EVENT',
	TICKETED_EVENT = 'TICKETED_EVENT',
	INFO = 'INFO',
}

@Entity('park_schedules')
@Index(['parkId', 'date'], { unique: true })
export class ParkSchedule {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ type: 'date' })
	date!: Date;

	@Column({ name: 'opening_time', type: 'time', nullable: true })
	openingTime?: string;

	@Column({ name: 'closing_time', type: 'time', nullable: true })
	closingTime?: string;

	@Column({
		type: 'enum',
		enum: ParkScheduleType,
		name: 'schedule_type',
	})
	scheduleType!: ParkScheduleType;

	@Column({ nullable: true })
	description?: string;

	@Column({ name: 'is_special', default: false })
	isSpecial!: boolean;

	@Column({ name: 'last_synced', nullable: true })
	lastSynced?: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	// Relations
	@Column({ name: 'park_id' })
	parkId!: string;

	@ManyToOne(() => Park, (park) => park.schedules, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'park_id' })
	park!: Park;
}
