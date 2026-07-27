import { InferAttributes, InferCreationAttributes } from 'sequelize';
import { Table, Column, Model, DataType } from 'sequelize-typescript';
import { OutletProfileStatusEnum } from '../enum/outlet-profile-enum';

@Table({
  paranoid: true,
  timestamps: true,
})
export class OutletProfileMetadata extends Model<InferAttributes<OutletProfileMetadata>, InferCreationAttributes<OutletProfileMetadata>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV1
  })
  declare id: string;

  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare merchantId: string;
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare outletId: string;

  @Column({
    type: DataType.UUID,
    allowNull: false
  })
  declare profileId: string

  @Column({
    type: DataType.STRING(150),
    allowNull: true,
  })
  declare merchantName: string;

  @Column({
    type: DataType.STRING(150),
    allowNull: true,
  })
  declare merchantNameAr: string;

  @Column({
    type: DataType.STRING(2000),
    allowNull: true,
  })
  declare name: string;

  @Column({
    type: DataType.STRING(2000),
    allowNull: true,
  })
  declare nameAr: string;


  @Column({
    type: DataType.ENUM(...Object.values(OutletProfileStatusEnum)),
    allowNull: true,
  })
  declare status: OutletProfileStatusEnum;


  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare description: string;

  @Column({
    type: DataType.TEXT,
    allowNull: true,
  })
  declare descriptionAr: string;
  @Column({
    type: DataType.STRING(2000),
    allowNull: true,
  })
  declare merchantLogoUrl: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare maxOffer: number;

  @Column({
    type: DataType.UUID,
    allowNull: true,
  })
  declare updatedBy: string;
}
