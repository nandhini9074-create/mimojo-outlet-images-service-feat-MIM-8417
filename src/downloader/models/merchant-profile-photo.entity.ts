import { CreationOptional, InferAttributes, InferCreationAttributes } from 'sequelize';
import { Table, Column, Model, DataType, ForeignKey, BelongsTo } from 'sequelize-typescript';



@Table({
  paranoid: true,
  timestamps: true,
})
export class MerchantProfilePhoto extends Model<InferAttributes<MerchantProfilePhoto>, InferCreationAttributes<MerchantProfilePhoto>> {
  @Column({
    type: DataType.UUID,
    primaryKey: true,
    defaultValue: DataType.UUIDV1
  })
  declare id: CreationOptional<string>;

  @Column({
    type: DataType.STRING(2000),
    allowNull: true,
  })
  declare cdnUrl: string;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare sortOrder: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare height: number;

  @Column({
    type: DataType.INTEGER,
    allowNull: true,
  })
  declare width: number;
  
  @Column({
    type: DataType.BOOLEAN,
    allowNull: true,
  })
  declare isActive: boolean;

  @Column({
    type: DataType.BOOLEAN,
    allowNull: true,
    defaultValue:false
  })
  declare isDefault: boolean;
  
  @Column({
    type: DataType.UUID,
    allowNull: false,
  })
  declare merchantProfileMetadataId: string;
}
