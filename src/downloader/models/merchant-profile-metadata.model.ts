import { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { BelongsTo, Column, DataType, ForeignKey, Model, Table } from 'sequelize-typescript';
import { MerchantProfileStatusEnum } from '../enum/merchant-profile-status-enum';
import { Merchant } from './merchant.model';
@Table({
  paranoid: true,
  timestamps: true,
})
export class MerchantProfileMetadata extends Model<
  InferAttributes<MerchantProfileMetadata>,
  InferCreationAttributes<MerchantProfileMetadata>
> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV1,
  })
  declare id: CreationOptional<string>;

  @ForeignKey(() => Merchant)
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare merchantId: string;
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  profileId: string;
  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  name: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  nameAr: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  maxOfferValue: number;

  @Column({
    type: DataType.ENUM(...Object.values(MerchantProfileStatusEnum)),
    defaultValue: MerchantProfileStatusEnum.PENDING,
  })
  status: MerchantProfileStatusEnum;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  activeOutletsNum: number;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  inActiveOutletsNum: number;
  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare imageUrl: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare desc: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare descAr: string;
  @Column({
    type: DataType.UUID,
  })
  declare updatedBy: string;

  @BelongsTo(() => Merchant)
  declare merchant: Merchant;
}
