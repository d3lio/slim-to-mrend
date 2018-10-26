'use strict';
// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import * as path from 'path';

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "slim-to-mrend" is now active!');

    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    function mdMetadata(title: string, lang: string = 'bg'): string {
        const date = new Date().toLocaleDateString(lang, dateOptions).slice(0, -3);
        return '' +
`---
title: ${title}
author: Rust@FMI team
date: ${date}
lang: ${lang}
keywords: rust,fmi
slide-width: 80%
font-size: 24px
font-family: Arial, Helvetica, sans-serif
code-theme: github
`;
    }

    function withinIndent(line: string, indent: number): boolean {
        return line.startsWith(' '.repeat(indent)) || line.length === 0;
    }

    function replaceIndentedBlock(
        content: string,
        beginRe: RegExp,
        { before = '', after = '', lineMap = text => text }: {
            before?: string,
            after?: string,
            lineMap?: (text: string) => string,
        }): string
    {
        if (after) {
            after += '\n';
        }

        let indent = 0;
        let insideIndentedBlock = false;
        const lines = content.split('\n').map((line: string, index: number, lines: string[]) => {
            if (insideIndentedBlock) {
                const lastEmptyLine =
                    line.length === 0 &&
                    lines[index + 1] &&
                    !withinIndent(lines[index + 1], indent);

                // empty line after list
                if (lastEmptyLine) {
                    insideIndentedBlock = false;
                    return after;
                }
                if (withinIndent(line, indent)) {
                    return lineMap(line.slice(indent))
                }
            }
            const match = beginRe.exec(line);
            if (match && match[1]) {
                indent = match[1].length + 2;
                insideIndentedBlock = true;
                return before;
            }
            return line;
        });

        return lines.join('\n');
    }

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with  registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand('mrend.convert', () => {
        // The code you place here will be executed every time your command is executed

        // Ge the current text editor
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            return;
        }

        const fileName = path.parse(editor.document.fileName).name;
        const metadata = mdMetadata(fileName);

        let content = editor.document.getText();

        content = content
            .replace(/^= slide '(.*?)'(?:,\s*'(.*?)')?\s*do$/gm, (_match, head, subhead) => {
                const template = `---\n\n# ${head}\n`;
                return subhead
                    ? template + `\n### ${subhead}\n`
                    : template;
            })
            .replace(/<code>([\s\S]*?)<\/code>/gm, '$1')
            .replace(/<strong>([\s\S]*?)<\/strong>/gm, '**$1**')
            .replace(/<b>([\s\S]*?)<\/b>/gm, '**$1**')
            .replace(/<i>([\s\S]*?)<\/i>/gm, '*$1*')
            .replace(/^\s*p(?:\.action)? (.+)/gm, '\n$1')
            .replace(/^\s*img src="(.*?)"/gm, '\n![]($1)')

        content = replaceIndentedBlock(content, /^(\s*)list:/gm, {
            lineMap: (text: string) => `--\n* ${text}`,
        });

        content = replaceIndentedBlock(content, /^(\s*)example:/gm, {
            before: '```rust',
            after: '```',
        });

        content = metadata + content;

        editor.edit((builder: vscode.TextEditorEdit) => {
            const document = editor.document;
			const lastLine = document.lineAt(document.lineCount - 1);

			const start = new vscode.Position(0, 0);
			const end = new vscode.Position(document.lineCount - 1, lastLine.text.length);

            builder.replace(new vscode.Range(start, end), content);

            vscode.languages.setTextDocumentLanguage(document, 'markdown');
        });
    });

    context.subscriptions.push(disposable);
}
