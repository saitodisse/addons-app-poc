import { readFile, readdir, stat } from 'node:fs/promises';
import { dirname, extname, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(fileURLToPath(new URL('..', import.meta.url)));
const checkReferences = process.argv.includes('--references');
const excludedDirectories = new Set(['.git', 'node_modules', 'dist', 'coverage', '.vite', 'temp']);
const excludedFiles = new Set(['zed', relative(root, fileURLToPath(import.meta.url))]);

// These markers catch high-signal Portuguese and Spanish words without treating
// supported language codes, URLs, or proper names as untranslated prose.
const translatedLanguageMarkers = [
  'ação', 'acoes', 'adicionar', 'adicionando', 'aguardando', 'apagar', 'arquivo', 'arquivos',
  'artigo', 'artigos', 'atualizacao', 'bloqueado', 'busca', 'buscar', 'caminho', 'carregar',
  'carregando', 'catalogo', 'codigo', 'configuracao', 'conteudo', 'continuacao', 'declarado',
  'descricao', 'destino', 'diretorio', 'documentacao', 'entrada', 'enviado', 'escolha', 'estado',
  'excluido', 'execucao', 'falha', 'fechar', 'funcao', 'historico', 'idioma', 'iniciar', 'instalar',
  'instalado', 'instalacao', 'limite', 'linhas', 'localizacao', 'manifesto', 'memoria', 'mensagem',
  'metadados', 'navegar', 'navegacao', 'obrigatorio', 'pagina', 'paginas', 'parar', 'pergunta',
  'persistido', 'provedor', 'proxima', 'proximo', 'recebido', 'registrado', 'registro', 'remover',
  'resposta', 'restaurar', 'resultado', 'resultados', 'revisao', 'rodando', 'salvar', 'secao',
  'selecionado', 'servidor', 'servico', 'servicos', 'sessao', 'tela', 'titulo', 'transito',
  'validacao', 'valido', 'verificacao', 'verificar', 'visualizar', 'aleatorio', 'aleatorios',
  'portugues', 'brasil', 'bola', 'inexistente', 'classicos', 'texto', 'textos', 'resumo', 'resumos',
  'abas', 'extensao', 'extensoes', 'demonstracao', 'executar', 'sair', 'limpar', 'limpeza', 'ouvindo',
  'conexao', 'dependencia', 'dependencias', 'invalido', 'invalida', 'rejeitado', 'rejeitada', 'aceito',
  'aceita', 'ausente', 'ausentes', 'necessario', 'necessaria', 'interno', 'interna', 'publico', 'publica',
  'privado', 'privada', 'segredo', 'segredos', 'imagem', 'imagens', 'miniatura', 'abrir', 'copia', 'copiar',
  'copiado', 'configurar', 'sugerido', 'sugestao', 'sugestoes', 'producao', 'homologacao', 'subir', 'publicar',
  'versao', 'falhou', 'comecar', 'terminar', 'encerrando', 'requisicao', 'requisicoes', 'corpo', 'cabecalho',
  'cabecalhos', 'metodo', 'metodos', 'origem', 'salvo', 'limpo', 'vivos', 'usuario', 'usuarios', 'pessoa',
  'pessoas', 'manter', 'mantem', 'somente', 'tambem', 'entao', 'depois', 'antes', 'durante', 'enquanto',
  'atraves', 'invalida', 'respuesta', 'contenido', 'busqueda', 'pestana', 'directorio', 'dependencias',
  'implementacion', 'guardado', 'rechazado', 'aceptado', 'solicitud', 'cabecera', 'aleatorio', 'sugerencia',
];

const markerPatterns = translatedLanguageMarkers.map((marker) => new RegExp(
  `(?:^|[^\\p{L}])${marker}(?:$|[^\\p{L}])`,
  'iu',
));

async function collectFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const absolutePath = resolve(directory, entry.name);
    const relativePath = relative(root, absolutePath);
    if (entry.isDirectory()) {
      if (!excludedDirectories.has(entry.name)) files.push(...await collectFiles(absolutePath));
      continue;
    }
    if (!excludedFiles.has(relativePath)) files.push(absolutePath);
  }
  return files;
}

async function readTextFile(filePath) {
  const buffer = await readFile(filePath);
  if (buffer.includes(0)) return undefined;
  return buffer.toString('utf8');
}

function findLanguageMarkers(text) {
  const findings = [];
  for (const [index, line] of text.split('\n').entries()) {
    if (/[À-ÖØ-öø-ÿ]/u.test(line)) findings.push({ line: index + 1, reason: 'accented non-English text' });
    for (const [markerIndex, pattern] of markerPatterns.entries()) {
      if (pattern.test(line)) {
        findings.push({ line: index + 1, reason: `language marker "${translatedLanguageMarkers[markerIndex]}"` });
      }
    }
  }
  return findings;
}

async function checkLanguage(files) {
  const findings = [];
  for (const filePath of files) {
    const text = await readTextFile(filePath);
    if (text === undefined) continue;
    for (const finding of findLanguageMarkers(text)) {
      findings.push(`${relative(root, filePath)}:${finding.line}: ${finding.reason}`);
    }
  }
  return findings;
}

async function checkMarkdownReferences(files) {
  const findings = [];
  const markdownFiles = files.filter((filePath) => ['.md', '.mdx'].includes(extname(filePath).toLowerCase()));
  const linkPattern = /!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+["'][^)]*["'])?\)/gu;

  for (const filePath of markdownFiles) {
    const text = await readTextFile(filePath);
    if (text === undefined) continue;
    for (const [index, line] of text.split('\n').entries()) {
      for (const match of line.matchAll(linkPattern)) {
        const target = match[1].replace(/^<|>$/gu, '');
        if (/^(?:[a-z][a-z\d+.-]*:|#)/iu.test(target)) continue;
        const pathTarget = decodeURIComponent(target.split(/[?#]/u, 1)[0]);
        const absoluteTarget = resolve(dirname(filePath), pathTarget);
        let targetExists = false;
        try {
          await stat(absoluteTarget);
          targetExists = true;
        } catch {
          targetExists = false;
        }
        if (!targetExists) findings.push(`${relative(root, filePath)}:${index + 1}: missing reference ${target}`);
      }
    }
  }
  return findings;
}

const files = await collectFiles(root);
const languageFindings = await checkLanguage(files);
if (languageFindings.length > 0) {
  console.error('ENGLISH CHECK FAILED');
  for (const finding of languageFindings) console.error(finding);
  process.exitCode = 1;
} else {
  console.log('ENGLISH CHECK PASSED');
}

if (checkReferences) {
  const referenceFindings = await checkMarkdownReferences(files);
  if (referenceFindings.length > 0) {
    console.error('REFERENCE CHECK FAILED');
    for (const finding of referenceFindings) console.error(finding);
    process.exitCode = 1;
  } else {
    console.log('REFERENCE CHECK PASSED');
  }
}
