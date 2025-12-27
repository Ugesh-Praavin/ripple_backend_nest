import fetch from 'node-fetch';
import { Injectable } from '@nestjs/common';
import { MLPrediction } from '../reports/reports.types';

@Injectable()
export class MLService {
  private ML_API = 'https://ripple-model-dfgk.onrender.com/predict';

  async verifyImage(imageUrl: string): Promise<MLPrediction | null> {
    const imageBuffer = await fetch(imageUrl).then((res) => res.buffer());

    const formData = new FormData();
    formData.append('image', imageBuffer);

    const response = await fetch(this.ML_API, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) return null;

    return (await response.json()) as MLPrediction;
  }
}
