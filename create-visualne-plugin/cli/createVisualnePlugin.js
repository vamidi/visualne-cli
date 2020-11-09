import chalk from 'chalk';
import fs from 'fs';
import { copy, removeSync } from 'fs-extra';
import arg from 'arg';
import inquirer from 'inquirer';
import path from 'path';
import execa from 'execa';
import { version } from '../../package.json';
import { createProject } from "./main";

const errorAlert = `${chalk.red.bold('ERROR')}`;
const errorLink = `${chalk.dim(chalk.underline('https://github.com/snowpackjs/snowpack'))}`;

function parseArgumentsInToOptions(program) {
    const args = arg(
        {
            '--git': Boolean,
            '--yes': Boolean,
            '--install': Boolean,
            '--template': String,
            '-g': '--git',
            '-y': '--yes',
            '-i': '--install',
            '-t': '--template',
        },
        {
            argv: program.rawArgs.slice(2),
        }
    );
    return {
        skipPrompts: program.yes || false,
        git: program.git || false,
        template: args._[0],
        runInstall: program.install || false,
    };
}

async function promptForMissingOptions(options) {
    const defaultTemplate = 'Typescript';
    if(options.skipPrompts) {
        return {
            ...options,
            template: options.template || defaultTemplate,
        };
    }

    const questions = [];
    if(!options.template) {
        questions.push({
            type: 'list',
            name: 'template',
            message: 'Please choose which project template to use',
            choices: ['Javascript', 'Typescript'],
            default: defaultTemplate,
        });
    }

    if(!options.git) {
        questions.push({
           type: 'confirm',
           name: 'git',
           message: 'Initialize a git repository?',
           default: false,
        });
    }

    const answers = await inquirer.prompt(questions);
    return {
        ...options,
        template: options.template || answers.template,
        git: options.git || answers.git,
    }
}

async function verifyProjectTemplate(isLocalTemplate, {template, dir}) {
    let keywords;
    if (isLocalTemplate) {
        const packageManifest = path.join(dir, 'package.json');
        keywords = require(packageManifest).keywords;
    } else {
        try {
            const {stdout} = await execa('npm', ['info', template, 'keywords', '--json']);
            keywords = JSON.parse(stdout);
        } catch (err) {
            console.log();
            if (err.stderr) {
                console.error(
                    `${errorAlert} Unable to find "${chalk.cyan(template)}" in the npm registry.`,
                );
            } else {
                console.log(err);
            }
            console.error(`${errorAlert} Cannot continue safely. Exiting...`);
            process.exit(1);
        }
    }

    if (!keywords || !keywords.includes('csp-template')) {
        console.error(
            `\n${errorAlert} The template is not a CSP template (missing "${chalk.yellow(
                'csp-template',
            )}" keyword in package.json), check the template name to make sure you are using the current template name.`,
        );
        console.error(`${errorAlert} Cannot continue safely. Exiting...`);
        process.exit(1);
    }
}

async function cleanProject(dir) {
    const packageManifest = path.join(dir, 'package.json');
    removeSync(path.join(dir, 'package-lock.json'));
    removeSync(path.join(dir, 'node_modules'));

    const {scripts, webDependencies, dependencies, devDependencies} = require(packageManifest);
    const {prepare, start, build, test, ...otherScripts} = scripts;
    await fs.promises.writeFile(
        packageManifest,
        JSON.stringify(
            {
                scripts: {prepare, start, build, test, ...otherScripts},
                webDependencies,
                dependencies,
                devDependencies,
            },
            null,
            2,
        ),
    );
    await fs.promises.writeFile(
        path.join(dir, '.gitignore'),
        ['.build', 'build', 'web_modules', 'node_modules'].join('\n'),
    );
}

export async function cli(program) {
    let options = parseArgumentsInToOptions(program);
    console.log(options)
    // options = await promptForMissingOptions(options);

    options = {
        ...options,
        targetDirectory: options.targetDirectory || process.cwd()
    };

    const isLocalTemplate = program.template.startsWith('.'); // must start with a `.` to be considered local
    const installedTemplate = isLocalTemplate
        ? path.resolve(process.cwd(), program.template) // handle local template
        : path.join(options.targetDirectory, 'node_modules', program.template); // handle template from npm/yarn

    console.log(isLocalTemplate, installedTemplate);

    await verifyProjectTemplate(isLocalTemplate, {dir: installedTemplate, template: program.template });

    console.log(`\n  - Using template ${chalk.cyan(program.template)}`);
    console.log(`  - Creating a new project in ${chalk.cyan(options.targetDirectory)}`);

    fs.mkdirSync(options.targetDirectory, {recursive: true});
    await fs.promises.writeFile(path.join(options.targetDirectory, 'package.json'), `{"name": "my-csp-app"}`);
    // fetch from npm or GitHub if not local (which will be most of the time)
    if (!isLocalTemplate) {
        try {
            await execa('npm', ['install', program.template, '--ignore-scripts'], {
                cwd: options.targetDirectory,
                all: true,
            });
        } catch (err) {
            // Only log output if the command failed
            console.error(err.all);
            throw err;
        }
    }

    await copy(installedTemplate, options.targetDirectory);
    await cleanProject(options.targetDirectory);
}
