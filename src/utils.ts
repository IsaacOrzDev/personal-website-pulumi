import * as pulumi from '@pulumi/pulumi';
import * as fs from 'fs';

export function getValue<T>(output: pulumi.Output<T>) {
  return new Promise<T>((resolve, reject) => {
    output.apply((value) => {
      resolve(value);
    });
  });
}

export const crawlDirectory = (dir: string, f: (_: string) => void) => {
  try {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      const filePath = `${dir}/${file}`;
      const stat = fs.statSync(filePath);
      if (stat.isDirectory()) {
        crawlDirectory(filePath, f);
      }
      if (stat.isFile()) {
        f(filePath);
      }
    }
  } catch (err) {
    console.log('The folder does not exist or do not contain files');
  }
};
