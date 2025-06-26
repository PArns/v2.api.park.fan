import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	ManyToOne,
	OneToMany,
	JoinColumn,
	Index,
} from 'typeorm';
import { Park } from './park.entity';
import { WaitTime } from './wait-time.entity';
import { ShowTime } from './show-time.entity';

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

@Entity('attractions')
@Index(['externalId'], { unique: true })
@Index(['parkId', 'entityType'])
export class Attraction {
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

	@Column({
		type: 'enum',
		enum: EntityType,
		name: 'entity_type',
	})
	entityType!: EntityType;

	@Column({ type: 'decimal', precision: 10, scale: 8, nullable: true })
	latitude?: number;

	@Column({ type: 'decimal', precision: 11, scale: 8, nullable: true })
	longitude?: number;

	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	@Column({ name: 'park_id' })
	parkId!: string;

	@ManyToOne(() => Park, (park) => park.attractions, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'park_id' })
	park!: Park;

	@OneToMany(() => WaitTime, (waitTime) => waitTime.attraction)
	waitTimes!: WaitTime[];

	@OneToMany(() => ShowTime, (showTime) => showTime.attraction)
	showTimes!: ShowTime[];

	@Column({
		type: 'enum',
		enum: OperatingStatus,
		nullable: true,
	})
	status?: OperatingStatus;

	@Column({ name: 'last_synced', nullable: true })
	lastSynced?: Date;
}
