import {
	Entity,
	PrimaryGeneratedColumn,
	Column,
	CreateDateColumn,
	UpdateDateColumn,
	OneToMany,
	Index,
} from 'typeorm';
import { Park } from './park.entity';

@Entity('park_groups')
@Index(['externalId'], { unique: true })
export class ParkGroup {
	@PrimaryGeneratedColumn('uuid')
	id!: string;

	// ThemeParks Wiki Destination ID - for updates and synchronization
	@Column({ name: 'external_id', unique: true })
	externalId!: string;

	@Column()
	name!: string;

	@Column({ nullable: true })
	slug?: string;

	@Column({ name: 'is_active', default: false })
	isActive!: boolean;

	@Column({ name: 'last_synced', nullable: true })
	lastSynced?: Date;

	@CreateDateColumn({ name: 'created_at' })
	createdAt!: Date;

	@UpdateDateColumn({ name: 'updated_at' })
	updatedAt!: Date;

	// Relations
	@OneToMany(() => Park, (park) => park.parkGroup)
	parks!: Park[];
}
