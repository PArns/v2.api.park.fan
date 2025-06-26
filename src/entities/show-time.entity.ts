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
import { Attraction } from './attraction.entity';

export enum ShowType {
	REGULAR = 'REGULAR',
	SPECIAL = 'SPECIAL',
	SEASONAL = 'SEASONAL',
	FIREWORKS = 'FIREWORKS',
	PARADE = 'PARADE',
}

@Entity('show_times')
// Unique index to avoid duplicate show entries
@Index(['attractionId', 'startTime', 'endTime'], { unique: true })
// Index for querying shows of an attraction by start time
@Index(['attractionId', 'startTime'])
export class ShowTime {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	@Column({ name: 'start_time', type: 'timestamp' })
	startTime!: Date;

	@Column({ name: 'end_time', type: 'timestamp' })
	endTime!: Date;

	@Column({
		type: 'enum',
		enum: ShowType,
		name: 'show_type',
	})
	showType!: ShowType;

	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	@Column({ name: 'last_synced', nullable: true })
	lastSynced?: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	// Relations
	@Column({ name: 'attraction_id' })
	attractionId!: string;

	@ManyToOne(() => Attraction, (attraction) => attraction.showTimes, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'attraction_id' })
	attraction!: Attraction;
}
