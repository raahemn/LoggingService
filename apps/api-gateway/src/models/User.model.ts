import { Schema, model, Document } from 'mongoose'

export interface IUser extends Document {
  username: string
  email: string
  active: boolean
  starredMessages: string[]
}

const UserSchema = new Schema<IUser>({
  username: {
    type: String,
    required: true,
    trim: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
  },
  active: {
    type: Boolean,
    default: true,
  },
  starredMessages: {
    type: [String],
    default: [],
  },
}, {
  timestamps: true,
})

UserSchema.index({ active: 1 }); // For filtering active users

export default model<IUser>('User', UserSchema)