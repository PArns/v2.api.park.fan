import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	ManyToOne,
	JoinColumn,
	Index,
} from 'typeorm';
import { Purchase, PurchaseType } from './purchase.entity';

@Entity('purchase_history')
// Index for efficient historical queries
@Index(['purchaseId', 'recordedAt'])
@Index(['recordedAt']) // For time-range queries
@Index(['available', 'recordedAt']) // For availability analytics
@Index(['priceAmount', 'recordedAt']) // For price trend analysis
@Index(['purchaseId', 'isActive', 'recordedAt']) // For current data lookup
export class PurchaseHistory {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// Historical snapshot data
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

	// Track if this is the current/active record
	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	// When this data was recorded
	@Column({ name: 'recorded_at' })
	recordedAt!: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	// Relations
	@Column({ name: 'purchase_id' })
	purchaseId!: string;

	@ManyToOne(() => Purchase, { onDelete: 'CASCADE' })
	@JoinColumn({ name: 'purchase_id' })
	purchase!: Purchase;
}
