import {AnalysisReport} from '../types';
export interface AIService{explain(report:AnalysisReport):Promise<string>}
export class DeterministicAIService implements AIService{async explain(report:AnalysisReport){return `${report.primary.inference} ${report.primary.suggestion}`}}
export const aiService:AIService=new DeterministicAIService();