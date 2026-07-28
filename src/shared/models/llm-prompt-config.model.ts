import { Column, DataType, Model, Table } from 'sequelize-typescript';

@Table({ tableName: 'llm_prompt_configs', timestamps: true })
export class LlmPromptConfig extends Model<
  LlmPromptConfig,
  Partial<LlmPromptConfig>
> {
  @Column({
    type: DataType.UUID,
    defaultValue: DataType.UUIDV4,
    primaryKey: true,
  })
  declare id: string;

  @Column({ type: DataType.TEXT, allowNull: false })
  declare promptText: string;

  @Column({ type: DataType.STRING, allowNull: false, unique: true, defaultValue: 'default' })
  declare profile_id: string;
}
