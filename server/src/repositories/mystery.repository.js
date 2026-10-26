import { Mystery } from '../models/Mystery.js';
import { MysterySolution } from '../models/MysterySolution.js';

export class MongoMysteryRepository {
  constructor({ MysteryModel = Mystery, MysterySolutionModel = MysterySolution } = {}) {
    this.MysteryModel = MysteryModel;
    this.MysterySolutionModel = MysterySolutionModel;
  }

  async savePlayableMystery({ ownerId, facts, solution, generationMetadata, promptVersion }) {
    const mystery = new this.MysteryModel({
      ownerId,
      ...facts,
      status: 'generating',
      generationMetadata,
      promptVersion,
    });
    await mystery.save();
    try {
      await this.MysterySolutionModel.create({ mysteryId: mystery._id, ...solution });
      mystery.status = 'playable';
      await mystery.save();
      return mystery;
    } catch (error) {
      await Promise.allSettled([
        this.MysterySolutionModel.deleteOne({ mysteryId: mystery._id }),
        this.MysteryModel.deleteOne({ _id: mystery._id, ownerId }),
      ]);
      throw error;
    }
  }

  async getOwnedPlayableMystery({ mysteryId, ownerId }) {
    try {
      return await this.MysteryModel.findOne({ _id: mysteryId, ownerId, status: 'playable' }).lean();
    } catch (error) {
      if (error?.name === 'CastError') return null;
      throw error;
    }
  }

  async listOwnedPlayableMysteries({ ownerId, limit = 50 }) {
    return this.MysteryModel.find({ ownerId, status: 'playable' })
      .sort({ createdAt: -1 })
      .limit(limit)
      .lean();
  }
}
