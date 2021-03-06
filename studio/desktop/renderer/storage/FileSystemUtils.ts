/**
 * This file basically just takes the Node.js `fs` module and exposes a nicer
 * promise based API.
 */

import * as fs from 'fs';

export function createDirectory(directoryPath: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.mkdir(directoryPath, error => (error ? reject(error) : resolve()));
  });
}

export function readDirectory(directoryPath: string): Promise<Array<string>> {
  return new Promise<Array<string>>((resolve, reject) => {
    fs.readdir(
      directoryPath,
      (error, files) => (error ? reject(error) : resolve(files)),
    );
  });
}

export function directoryExists(filePath: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    fs.access(filePath, error => resolve(!error));
  });
}

export function writeFile(filePath: string, data: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    fs.writeFile(filePath, data, error => (error ? reject(error) : resolve()));
  });
}

export function readFileAsString(filePath: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(
      filePath,
      'utf8',
      (error, file) => (error ? reject(error) : resolve(file)),
    );
  });
}

export function fileExists(filePath: string): Promise<boolean> {
  return new Promise<boolean>((resolve, reject) => {
    fs.access(filePath, error => resolve(!error));
  });
}

export function fileByteSize(filePath: string): Promise<number> {
  return new Promise<number>((resolve, reject) => {
    fs.stat(
      filePath,
      (error, stats) => (error ? reject(error) : resolve(stats.size)),
    );
  });
}
