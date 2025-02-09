// This file contains utility functions that support the main algorithm implementation.
// It exports functions that may assist with tasks like data manipulation or mathematical calculations relevant to the algorithm.

export function calculateDistance(pointA: { x: number; y: number }, pointB: { x: number; y: number }): number {
    return Math.sqrt(Math.pow(pointB.x - pointA.x, 2) + Math.pow(pointB.y - pointA.y, 2));
}

export function normalizeArray(arr: number[]): number[] {
    const max = Math.max(...arr);
    const min = Math.min(...arr);
    return arr.map(value => (value - min) / (max - min));
}

export function sortByKey<T>(array: T[], key: keyof T): T[] {
    return array.sort((a, b) => (a[key] > b[key] ? 1 : -1));
}