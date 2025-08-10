// Utilitaires mathématiques et statistiques pour l'analyse d'artistes

export class MathUtils {
  /**
   * Calcule la moyenne d'un tableau de nombres
   */
  static mean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calcule la médiane d'un tableau de nombres
   */
  static median(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    
    return sorted.length % 2 === 0
      ? (sorted[mid - 1] + sorted[mid]) / 2
      : sorted[mid];
  }

  /**
   * Calcule l'écart-type d'un tableau de nombres
   */
  static standardDeviation(values: number[]): number {
    if (values.length === 0) return 0;
    
    const avg = this.mean(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - avg, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Calcule les percentiles d'un tableau de nombres
   */
  static percentile(values: number[], percentile: number): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const index = (percentile / 100) * (sorted.length - 1);
    
    if (Number.isInteger(index)) {
      return sorted[index];
    } else {
      const lower = Math.floor(index);
      const upper = Math.ceil(index);
      const weight = index - lower;
      
      return sorted[lower] * (1 - weight) + sorted[upper] * weight;
    }
  }

  /**
   * Normalise une valeur entre 0 et 1
   */
  static normalize(value: number, min: number, max: number): number {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  /**
   * Normalise une valeur entre 0 et 10
   */
  static normalizeToTen(value: number, min: number, max: number): number {
    return this.normalize(value, min, max) * 10;
  }

  /**
   * Applique une fonction sigmoïde pour lisser les valeurs
   */
  static sigmoid(x: number, steepness: number = 1): number {
    return 1 / (1 + Math.exp(-steepness * x));
  }

  /**
   * Calcule la corrélation de Pearson entre deux séries
   */
  static pearsonCorrelation(x: number[], y: number[]): number {
    if (x.length !== y.length || x.length === 0) return 0;
    
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);
    
    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
    
    return denominator === 0 ? 0 : numerator / denominator;
  }

  /**
   * Calcule l'indice de Gini pour mesurer l'inégalité
   */
  static giniCoefficient(values: number[]): number {
    if (values.length === 0) return 0;
    
    const sorted = [...values].sort((a, b) => a - b);
    const n = sorted.length;
    const sum = sorted.reduce((a, b) => a + b, 0);
    
    if (sum === 0) return 0;
    
    let gini = 0;
    for (let i = 0; i < n; i++) {
      gini += (2 * (i + 1) - n - 1) * sorted[i];
    }
    
    return gini / (n * sum);
  }

  /**
   * Calcule l'indice de Herfindahl-Hirschman pour mesurer la concentration
   */
  static herfindahlIndex(marketShares: number[]): number {
    return marketShares.reduce((sum, share) => sum + share * share, 0);
  }

  /**
   * Lisse une série temporelle avec une moyenne mobile
   */
  static movingAverage(values: number[], window: number): number[] {
    if (window <= 0 || window > values.length) return values;
    
    const result: number[] = [];
    
    for (let i = 0; i < values.length; i++) {
      const start = Math.max(0, i - Math.floor(window / 2));
      const end = Math.min(values.length, start + window);
      const slice = values.slice(start, end);
      result.push(this.mean(slice));
    }
    
    return result;
  }

  /**
   * Calcule la tendance linéaire d'une série temporelle
   */
  static linearTrend(values: number[]): { slope: number; intercept: number; r2: number } {
    if (values.length < 2) {
      return { slope: 0, intercept: 0, r2: 0 };
    }
    
    const x = Array.from({ length: values.length }, (_, i) => i);
    const n = values.length;
    
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * values[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = values.reduce((sum, yi) => sum + yi * yi, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;
    
    // Coefficient de détermination R²
    const yMean = sumY / n;
    const ssRes = values.reduce((sum, yi, i) => {
      const predicted = slope * i + intercept;
      return sum + Math.pow(yi - predicted, 2);
    }, 0);
    const ssTot = values.reduce((sum, yi) => sum + Math.pow(yi - yMean, 2), 0);
    const r2 = ssTot === 0 ? 1 : 1 - (ssRes / ssTot);
    
    return { slope, intercept, r2 };
  }

  /**
   * Détecte les outliers avec la méthode IQR
   */
  static detectOutliers(values: number[], factor: number = 1.5): {
    outliers: number[];
    lowerBound: number;
    upperBound: number;
  } {
    if (values.length === 0) {
      return { outliers: [], lowerBound: 0, upperBound: 0 };
    }
    
    const q1 = this.percentile(values, 25);
    const q3 = this.percentile(values, 75);
    const iqr = q3 - q1;
    
    const lowerBound = q1 - factor * iqr;
    const upperBound = q3 + factor * iqr;
    
    const outliers = values.filter(val => val < lowerBound || val > upperBound);
    
    return { outliers, lowerBound, upperBound };
  }

  /**
   * Calcule la distance euclidienne entre deux vecteurs
   */
  static euclideanDistance(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    const sumSquares = vector1.reduce((sum, val, i) => {
      return sum + Math.pow(val - vector2[i], 2);
    }, 0);
    
    return Math.sqrt(sumSquares);
  }

  /**
   * Calcule la similarité cosinus entre deux vecteurs
   */
  static cosineSimilarity(vector1: number[], vector2: number[]): number {
    if (vector1.length !== vector2.length) {
      throw new Error('Vectors must have the same length');
    }
    
    const dotProduct = vector1.reduce((sum, val, i) => sum + val * vector2[i], 0);
    const magnitude1 = Math.sqrt(vector1.reduce((sum, val) => sum + val * val, 0));
    const magnitude2 = Math.sqrt(vector2.reduce((sum, val) => sum + val * val, 0));
    
    if (magnitude1 === 0 || magnitude2 === 0) return 0;
    
    return dotProduct / (magnitude1 * magnitude2);
  }

  /**
   * Applique une pondération exponentielle décroissante
   */
  static exponentialDecay(values: number[], decayRate: number): number[] {
    return values.map((val, i) => val * Math.exp(-decayRate * i));
  }

  /**
   * Calcule un score composite pondéré
   */
  static weightedScore(
    scores: number[],
    weights: number[],
    normalize: boolean = true
  ): number {
    if (scores.length !== weights.length) {
      throw new Error('Scores and weights arrays must have the same length');
    }
    
    const weightSum = weights.reduce((sum, weight) => sum + weight, 0);
    if (weightSum === 0) return 0;
    
    const weightedSum = scores.reduce((sum, score, i) => sum + score * weights[i], 0);
    
    return normalize ? weightedSum / weightSum : weightedSum;
  }

  /**
   * Applique un lissage exponentiel
   */
  static exponentialSmoothing(values: number[], alpha: number): number[] {
    if (values.length === 0) return [];
    
    const smoothed = [values[0]];
    
    for (let i = 1; i < values.length; i++) {
      const smoothedValue = alpha * values[i] + (1 - alpha) * smoothed[i - 1];
      smoothed.push(smoothedValue);
    }
    
    return smoothed;
  }

  /**
   * Calcule l'entropie de Shannon pour mesurer la diversité
   */
  static shannonEntropy(frequencies: number[]): number {
    const total = frequencies.reduce((sum, freq) => sum + freq, 0);
    if (total === 0) return 0;
    
    const probabilities = frequencies.map(freq => freq / total);
    
    return -probabilities.reduce((entropy, prob) => {
      return prob > 0 ? entropy + prob * Math.log2(prob) : entropy;
    }, 0);
  }

  /**
   * Calcule l'indice de diversité de Simpson
   */
  static simpsonDiversityIndex(frequencies: number[]): number {
    const total = frequencies.reduce((sum, freq) => sum + freq, 0);
    if (total === 0) return 0;
    
    const sumSquares = frequencies.reduce((sum, freq) => sum + freq * freq, 0);
    
    return 1 - (sumSquares / (total * total));
  }

  /**
   * Arrondit un nombre à un nombre spécifique de décimales
   */
  static round(value: number, decimals: number = 2): number {
    const factor = Math.pow(10, decimals);
    return Math.round(value * factor) / factor;
  }

  /**
   * Clamp une valeur entre min et max
   */
  static clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
  }

  /**
   * Interpolation linéaire entre deux valeurs
   */
  static lerp(start: number, end: number, factor: number): number {
    return start + (end - start) * this.clamp(factor, 0, 1);
  }
}

