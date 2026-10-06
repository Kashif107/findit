import mongoose from 'mongoose';

export async function connectDB() {
  const uri = process.env.MONGODB_URI;
  if (!uri) throw new Error('MONGODB_URI is not set');
  mongoose.set('strictQuery', true);
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 });
  } catch (err) {
    throw new Error(
      `Cannot reach MongoDB at ${uri}. Start MongoDB (or run "docker compose up -d") or set MONGODB_URI to an Atlas URI. (${err.message})`
    );
  }
  console.log('[db] connected');
}
