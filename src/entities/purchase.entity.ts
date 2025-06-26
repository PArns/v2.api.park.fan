import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	Index,
} from 'typeorm';

export enum PurchaseType {
	PACKAGE = 'PACKAGE',
	ATTRACTION = 'ATTRACTION',
}

@Entity('purchases')
@Index(['externalId'], { unique: true })
@Index(['parkScheduleId', 'type'])
@Index(['parkScheduleId', 'available'])
export class Purchase {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// ThemeParks Wiki purchase ID
	@Column({ name: 'external_id', unique: true })
	externalId!: string;

	@Column()
	name!: string;

	@Column({
		type: 'enum',
		enum: PurchaseType,
	})
	type!: PurchaseType;

	// Price in cents (to avoid decimal issues)
	@Column({ name: 'price_amount', nullable: true })
	priceAmount?: number;

	@Column({ name: 'price_currency', length: 3, nullable: true })
	priceCurrency?: string;

	@Column({ name: 'price_formatted', nullable: true })
	priceFormatted?: string;

	@Column({ default: false })
	available!: boolean;

	@Column({ name: 'is_active', default: true })
	isActive!: boolean;

	@Column({ name: 'last_synced', nullable: true })
	lastSynced?: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	// Relations
	@Column({ name: 'park_schedule_id' })
	parkScheduleId!: string;
}
