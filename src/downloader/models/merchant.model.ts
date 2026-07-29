import { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { BelongsTo, BelongsToMany, Column, DataType, ForeignKey, HasMany, Model, Table } from 'sequelize-typescript';
import { MerchantPhoto } from './merchant-photo.model';
import { MerchantProfileMetadata } from './merchant-profile-metadata.model';
import { MerchantStatusEnum } from '../enum/merchant-status.enum';
import { MerchantPaymentPlanEnum } from '../enum/merchant-payment-plan.enum';

@Table({
  paranoid: true,
  timestamps: true,
  indexes: [
    {
      fields: ['group_id'],
    },
  ],
})
export class Merchant extends Model<InferAttributes<Merchant>, InferCreationAttributes<Merchant>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV1,
  })
  declare id: CreationOptional<string>;

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
    type: DataType.UUID,
    allowNull: true,
  })
  declare groupId: CreationOptional<string>;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  country: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  city: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  classification: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  salesPerson: string;

  @Column({
    type: DataType.DATE,
    allowNull: true,
  })
  currentDateTime: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  maxOfferValue: number;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare crmCategoryName: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare crmSubCategoryName: string;

  @Column({
    type: DataType.ENUM(...Object.values(MerchantStatusEnum)),
    defaultValue: MerchantStatusEnum.PENDING,
  })
  status: MerchantStatusEnum;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare imageUrl: string;

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
    allowNull: false,
  })
  declare financeContactFirstName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare financeContactLastName: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare financeContactJobTitle: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare financeContactEmail: string;

  @Column({
    type: DataType.STRING,
    allowNull: false,
  })
  declare financeContactMobile: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare tradeLicenseNumber: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare taxRegistrationNumber: string;

  @Column({
    type: DataType.STRING,
    allowNull: true,
  })
  declare merchantNo: string;

  @Column({
    type: DataType.ENUM(...Object.values(MerchantPaymentPlanEnum)),
    allowNull: false,
  })
  declare paymentPlan: CreationOptional<MerchantPaymentPlanEnum>;

  @Column({
    type: DataType.INTEGER,
    defaultValue: 0,
  })
  prepayAmount: number;

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
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
  })
  merchantMids: string[];

  @Column({
    type: DataType.ENUM(...Object.values(MerchantStatusEnum)),
    defaultValue: MerchantStatusEnum.NOT_ENROLLED,
  })
  fastPaymentStatus: MerchantStatusEnum;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
  })
  declare artDesc: string[] | null;

  @Column({
    type: DataType.ARRAY(DataType.STRING),
    allowNull: true,
  })
  declare competitorDesc: string[] | null;

  @HasMany(() => MerchantProfileMetadata)
  declare merchantProfiles: MerchantProfileMetadata[];

  @HasMany(() => MerchantPhoto)
  declare merchantPhotos: MerchantPhoto[];

  // @Column({
  //   type: DataType.UUID,
  // })
  // declare updatedBy: string;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: false,
  })
  isCircle: boolean;

  @Column({
    type: DataType.BOOLEAN,
    defaultValue: null,
  })
  isFirstActivationEmailSent: boolean;
}
