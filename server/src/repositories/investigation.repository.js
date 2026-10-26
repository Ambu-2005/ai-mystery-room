import { Investigation } from '../models/Investigation.js';
import { Mystery } from '../models/Mystery.js';
import { MysterySolution } from '../models/MysterySolution.js';

export class MongoInvestigationRepository {
  constructor({ InvestigationModel = Investigation, MysteryModel = Mystery, MysterySolutionModel = MysterySolution } = {}) {
    this.InvestigationModel = InvestigationModel;
    this.MysteryModel = MysteryModel;
    this.MysterySolutionModel = MysterySolutionModel;
  }

  async getPlayableMysteryForOwner({ mysteryId, userId }) {
    try {
      return await this.MysteryModel.findOne({ _id: mysteryId, ownerId: userId, status: 'playable' }).lean();
    } catch (error) {
      if (error?.name === 'CastError') return null;
      throw error;
    }
  }

  async startOrResume({ mysteryId, userId }) {
    try {
      return await this.InvestigationModel.findOneAndUpdate(
        { mysteryId, userId },
        { $setOnInsert: { mysteryId, userId, status: 'active', startedAt: new Date() } },
        { returnDocument: 'after', upsert: true, setDefaultsOnInsert: true, runValidators: true },
      ).lean();
    } catch (error) {
      if (error?.name === 'CastError') return null;
      if (error?.code === 11000) return this.InvestigationModel.findOne({ mysteryId, userId }).lean();
      throw error;
    }
  }

  async findOwned({ investigationId, userId }) {
    try {
      return await this.InvestigationModel.findOne({ _id: investigationId, userId }).lean();
    } catch (error) {
      if (error?.name === 'CastError') return null;
      throw error;
    }
  }

  async listOwnedForMysteries({ mysteryIds, userId }) {
    if (!mysteryIds.length) return [];
    return this.InvestigationModel.find({ mysteryId: { $in: mysteryIds }, userId })
      .select('_id mysteryId status score accusation')
      .lean();
  }

  async getMysteryForInvestigation({ mysteryId, userId }) {
    try {
      return await this.MysteryModel.findOne({ _id: mysteryId, ownerId: userId }).lean();
    } catch (error) {
      if (error?.name === 'CastError') return null;
      throw error;
    }
  }

  async getSolution({ mysteryId }) {
    try {
      return await this.MysterySolutionModel.findOne({ mysteryId })
        .select('+culpritId +motive +method +reasoning +decisiveEvidenceIds +redHerringExplanations +suspectExclusions')
        .lean();
    } catch (error) {
      if (error?.name === 'CastError') return null;
      throw error;
    }
  }

  async updateActive({ investigationId, userId, values }) {
    return this.InvestigationModel.findOneAndUpdate(
      { _id: investigationId, userId, status: 'active' },
      { $set: values },
      { returnDocument: 'after', runValidators: true },
    ).lean();
  }

  async completeActive({ investigationId, userId, accusation, score, scoreBreakdown, submittedAt }) {
    return this.InvestigationModel.findOneAndUpdate(
      { _id: investigationId, userId, status: 'active', accusation: null },
      { $set: { accusation, score, scoreBreakdown, status: 'completed', submittedAt, completedAt: submittedAt } },
      { returnDocument: 'after', runValidators: true },
    ).lean();
  }
}
