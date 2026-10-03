\NeedsTeXFormat{LaTeX2e}
\ProvidesClass{ifarticle}[2026/10/01 frontiers-print journal article]
% frontiers-print: the journal article design (spec.md), on LuaLaTeX. The build writes iflayout.def (the layout
% and typeface set, from layouts.json and typefaces.json) and defines \iffontdir and \branddir as absolute
% paths. Every brand color here is the theme's, from the brand's brand.tex (0014-design-systems FR-038).
\providecommand{\iffontdir}{fonts/}
\providecommand{\branddir}{../../frontiers-brand}

\InputIfFileExists{iflayout.def}{}{\ClassError{ifarticle}{iflayout.def not found: build the paper with tools/render/paper-build.sh}{}}
\newif\ififsingle
\ifnum\ifLcols=1 \ifsingletrue\else\ifsinglefalse\fi
\ififsingle
  \LoadClass[10pt,\ifLside,letterpaper]{article}
\else
  \LoadClass[10pt,twocolumn,\ifLside,letterpaper]{article}
\fi

\RequirePackage{fontspec}
\RequirePackage{polyglossia}
\setmainlanguage{english}

\RequirePackage[letterpaper,\ifLgeometry,headheight=12pt,headsep=\ifLheadsep,footskip=\ifLfootskip]{geometry}
\RequirePackage{changepage}
\newlength{\ifspan}
\newlength{\ifwide}
\setlength{\ifspan}{\ifLspan}
\setlength{\ifwide}{\dimexpr\textwidth+\ifspan\relax}
\setlength{\columnsep}{\ifLcolsep}
\setlength{\columnseprule}{0pt}

\directlua{luaotfload.add_fallback("ifsymmain", {\ifLfbmain})}
\directlua{luaotfload.add_fallback("ifsymsans", {\ifLfbsans})}
\edef\ifLtmp{\noexpand\setmainfont{\ifLmainfont}[\ifLmainopts,RawFeature={fallback=ifsymmain}]}\ifLtmp
\edef\ifLtmp{\noexpand\setsansfont{\ifLsansfont}[\ifLsansopts,RawFeature={fallback=ifsymsans}]}\ifLtmp
\edef\ifLtmp{\noexpand\newfontfamily\noexpand\ifsans{\ifLsansfont}[\ifLsansopts,RawFeature={fallback=ifsymsans}]}\ifLtmp
\newfontfamily\ifmono{SourceCodePro}[
  Path=\iffontdir, Extension=.ttf,
  UprightFont=*-Regular, BoldFont=*-Bold,
  ItalicFont=*-Italic, BoldItalicFont=*-BoldItalic,
  Scale=0.92,
]

\RequirePackage{amsmath}
\RequirePackage{unicode-math}
\setmathfont{STIXTwoMath-Regular.otf}[Path=\iffontdir]

\makeatletter
\renewcommand\normalsize{\@setfontsize\normalsize{\ifLbodysz}{\ifLbodyld}%
  \abovedisplayskip \ifLdispskip\p@ \@plus2\p@ \@minus2\p@
  \abovedisplayshortskip 3\p@ \@plus1\p@
  \belowdisplayskip \abovedisplayskip
  \belowdisplayshortskip \abovedisplayshortskip}
\renewcommand\small{\@setfontsize\small{\ifLsmallsz}{\ifLsmallld}}
\renewcommand\footnotesize{\@setfontsize\footnotesize{\ifLfootsz}{\ifLfootld}}
\renewcommand\scriptsize{\@setfontsize\scriptsize{7}{8.6}}
\renewcommand\large{\@setfontsize\large{11.5}{14}}
\renewcommand\Large{\@setfontsize\Large{14}{16.5}}
\renewcommand\LARGE{\@setfontsize\LARGE{19}{21.5}}
\makeatother
\normalsize

\RequirePackage{xcolor}
\input{\branddir/brand.tex}
\colorlet{ifink}{brand-text}
\colorlet{ifblue}{brand-primary}
\colorlet{ifoxblood}{brand-tertiary}
\colorlet{ifteal}{brand-secondary}
\definecolor{ifgray}{HTML}{5B6470}
\definecolor{ifrule}{HTML}{C9CED6}
\definecolor{iftint}{HTML}{F3F5F8}
\color{ifink}

\RequirePackage[protrusion=true,expansion=true,tracking=true,
  stretch=18,shrink=18]{microtype}
\setlength{\parindent}{1.05em}
\setlength{\parskip}{0pt}
\setlength{\emergencystretch}{1.4em}
\tolerance=900
\hbadness=3000
\clubpenalty=10000
\widowpenalty=10000
\displaywidowpenalty=10000
\flushbottom
\hyphenpenalty=300
\exhyphenpenalty=50
\doublehyphendemerits=12000
\finalhyphendemerits=9000
\AtBeginDocument{\lefthyphenmin=3\righthyphenmin=3}

\RequirePackage{graphicx}
\RequirePackage{booktabs}
\RequirePackage{array}\RequirePackage{colortbl}
\RequirePackage{enumitem}
\RequirePackage{fvextra}
\RequirePackage[most]{tcolorbox}
\RequirePackage{titlesec}
\RequirePackage{fancyhdr}
\RequirePackage{caption}
\RequirePackage{float}\RequirePackage{dblfloatfix}
\RequirePackage{needspace}
\RequirePackage{etoolbox}
\RequirePackage{xurl}
\RequirePackage[colorlinks=true,linkcolor=ifink,urlcolor=ifblue,citecolor=ifink,
  breaklinks=true,pdfusetitle=false]{hyperref}
\RequirePackage{hyperxmp}

\setlist{nosep,leftmargin=1.25em,itemsep=1.5pt,topsep=3pt,partopsep=0pt}
\setlist[description]{font=\ifsans\bfseries\small,leftmargin=0pt,labelindent=0pt}
\renewcommand{\labelitemi}{\textbullet}

\captionsetup{font={footnotesize,sf},labelfont={sf,bf},labelsep=period,
  justification=raggedright,singlelinecheck=false,skip=5pt}
\captionsetup[table]{position=top,skip=4pt}

\renewcommand{\topfraction}{0.9}
\renewcommand{\dbltopfraction}{0.92}
\renewcommand{\textfraction}{0.08}
\renewcommand{\floatpagefraction}{0.75}
\renewcommand{\dblfloatpagefraction}{0.75}
\setcounter{totalnumber}{5}
\makeatletter
\setlength{\@fptop}{0pt}\setlength{\@fpsep}{12pt plus 1fil}\setlength{\@fpbot}{0pt plus 2fil}
\setlength{\@dblfptop}{0pt}\setlength{\@dblfpsep}{12pt plus 1fil}\setlength{\@dblfpbot}{0pt plus 2fil}
\makeatother
\setcounter{topnumber}{3}
\setcounter{dbltopnumber}{3}
\setlength{\textfloatsep}{11pt plus 2pt minus 3pt}
\setlength{\dbltextfloatsep}{12pt plus 2pt minus 3pt}
\setlength{\floatsep}{9pt plus 2pt minus 2pt}
\setlength{\dblfloatsep}{9pt plus 2pt minus 2pt}

\newcommand{\setpaper}[2]{\expandafter\gdef\csname paper@#1\endcsname{#2}}
\newcommand{\paperval}[1]{\ifcsname paper@#1\endcsname\csname paper@#1\endcsname\fi}
\makeatletter
\newcommand{\iftext}[2]{\ifcsname paper@#1\endcsname\expandafter\ifx\csname paper@#1\endcsname\@empty\else#2\fi\fi}
\newcommand{\ifpaperempty}[3]{\ifcsname paper@#1\endcsname\expandafter\ifx\csname paper@#1\endcsname\@empty#2\else#3\fi\else#2\fi}
\newcommand{\ifpublished}[2]{\edef\if@tmpa{\paperval{published}}\def\if@tmpb{true}\ifx\if@tmpa\if@tmpb#1\else#2\fi}
\makeatother

\newcommand{\ifclaimlabel}{}
\newcommand{\ifclaimextra}{}
\newcommand{\ifclaimflagtext}{}
\newif\ifclaimpending
\newcommand{\setclaim}[3]{%
  \gdef\ifclaimlabel{#1}\gdef\ifclaimextra{#2}\gdef\ifclaimflagtext{#3}\claimpendingtrue}
\newcommand{\printclaim}{%
  \ifclaimpending
    \nobreak{\ifsans\fontsize{6.7}{8}\selectfont\bfseries\color{ifblue}%
     \textls[110]{\MakeUppercase{\ifclaimlabel}}%
     \ifdefempty{\ifclaimextra}{}{\ \textperiodcentered\ \textls[60]{\MakeUppercase{\ifclaimextra}}}%
     \ifdefempty{\ifclaimflagtext}{}{\ \textperiodcentered\ {\color{ifoxblood}\textls[60]{\MakeUppercase{\ifclaimflagtext}}}}%
     \par}\nobreak\vskip1.6pt\nobreak
    \global\claimpendingfalse
  \fi}

\newcommand{\ifhone}{\fontsize{\ifLhonesz}{\ifLhoneld}\selectfont}
\newcommand{\ifhtwo}{\fontsize{\ifLhtwosz}{\ifLhtwold}\selectfont}
\newcommand{\ifhthree}{\fontsize{\ifLhthreesz}{\ifLhthreeld}\selectfont}
\titleformat{\section}{\ifsans\bfseries\ifhone\color{ifink}\hyphenpenalty=2500\exhyphenpenalty=2500 }{}{0pt}
  {\color{ifrule}\titlerule[0.5pt]\vspace{3.2pt}\color{ifink}}
\titlespacing*{\section}{0pt}{1.5em plus 0.3em minus 0.2em}{0.55em plus 0.1em}
\titleformat{\subsection}{\ifsans\bfseries\ifhtwo\color{ifink}\hyphenpenalty=2500\exhyphenpenalty=2500 }{}{0pt}{}
\titlespacing*{\subsection}{0pt}{1.15em plus 0.25em minus 0.15em}{0.4em plus 0.08em}
\titleformat{\subsubsection}{\ifsans\bfseries\itshape\ifhthree\color{ifink}\hyphenpenalty=2500\exhyphenpenalty=2500 }{}{0pt}{}
\titlespacing*{\subsubsection}{0pt}{0.95em plus 0.2em minus 0.1em}{0.3em plus 0.08em}
\titleformat{\paragraph}[runin]{\bfseries\itshape}{}{0pt}{}[.]
\titlespacing*{\paragraph}{0pt}{0.8em plus 0.1em}{0.5em}

\tcbset{ifbase/.style={enhanced,breakable,sharp corners,boxrule=0pt,frame hidden,halign=flush left,
  colback=iftint,left=7pt,right=6pt,top=4.5pt,bottom=4.5pt,
  before skip=7pt,after skip=7pt,
  fontupper=\ifsans\fontsize{8.4}{10.8}\selectfont}}
\newtcolorbox{ifkeypoint}{ifbase,borderline west={1.6pt}{0pt}{ifblue}}
\newtcolorbox{ifnote}[1]{ifbase,borderline west={1.6pt}{0pt}{ifblue},
  before upper={{\ifsans\bfseries\fontsize{6.7}{8}\selectfont\color{ifblue}\textls[100]{\MakeUppercase{#1}}}\par\vspace{2pt}}}
\newtcolorbox{ifimportant}[1]{ifbase,borderline west={1.6pt}{0pt}{ifoxblood},
  before upper={{\ifsans\bfseries\fontsize{6.7}{8}\selectfont\color{ifoxblood}\textls[100]{\MakeUppercase{#1}}}\par\vspace{2pt}}}
\newtcolorbox{ifpractical}{enhanced,breakable,sharp corners,halign=flush left,colback=white,colframe=ifink,
  boxrule=0.45pt,left=6pt,right=6pt,top=3.5pt,bottom=3.5pt,before skip=5pt,after skip=7pt,
  fontupper=\ifsans\fontsize{8.4}{10.8}\selectfont,
  before upper={{\ifsans\bfseries\fontsize{6.7}{8}\selectfont\color{ifink}\textls[100]{PRACTICAL TEST}}\par\vspace{2pt}}}
\newtcolorbox{ifstatus}{enhanced,sharp corners,colback=iftint,frame hidden,boxrule=0pt,
  borderline north={1.2pt}{0pt}{ifink},left=7pt,right=7pt,top=6pt,bottom=5pt,
  before skip=0pt,after skip=0pt,
  fontupper=\ifsans\fontsize{8.5}{11}\selectfont,
  before upper={{\ifsans\bfseries\fontsize{6.9}{8.2}\selectfont\color{ifink}\textls[110]{STATUS OF THIS PAPER}}\par\vspace{3pt}}}
\newtcolorbox{ifquote}{enhanced,breakable,sharp corners,frame hidden,colback=white,
  borderline west={1.2pt}{0pt}{ifblue},left=9pt,right=2pt,top=1.5pt,bottom=1.5pt,
  before skip=7pt,after skip=8pt,fontupper=\itshape\fontsize{10.2}{13.2}\selectfont}
\newcommand{\ifquotecite}[1]{\par\upshape\small---#1}
\newenvironment{ifcode}
  {\par\vspace{5pt}\begin{tcolorbox}[enhanced,sharp corners,colback=iftint,frame hidden,
     borderline west={1.4pt}{0pt}{ifrule},left=7pt,right=6pt,top=3.5pt,bottom=3.5pt,
     before skip=0pt,after skip=0pt]\ifmono}
  {\end{tcolorbox}\par\vspace{6pt}}
\newcommand{\ifcodespan}[1]{{\ifmono\fontsize{7.9}{9}\selectfont #1}}

\newenvironment{ifreferences}
  {\small\setlength{\parindent}{-1.5em}\setlength{\leftskip}{1.5em}\setlength{\parskip}{2.2pt}\raggedright}
  {\par}
\newenvironment{ifrevisions}{\small}{\par}

\newcommand{\iftablefont}[1]{\ifsans\fontsize{#1pt}{\fpeval{#1*1.3}pt}\selectfont}
\newcommand{\iftableheadcell}[1]{{\bfseries\color{ifink}#1}}
\newcommand{\iftablerowrule}{\arrayrulecolor{ifrule}\midrule[0.25pt]\arrayrulecolor{ifink}}
\RequirePackage{marginfix}
\ifsideleft\reversemarginpar\fi
\newenvironment{ifspanning}{\begin{adjustwidth}{\ifLspanl}{\ifLspanr}}{\end{adjustwidth}}
\newcommand{\ifsidebox}[1]{\ififsidebar
  \marginpar{\raggedright\setlength{\parindent}{0pt}\setlength{\parskip}{0pt}#1}%
  \else #1\fi}
\newcommand{\ifincludefigure}[2]{\includegraphics[width=#2\linewidth,height=0.74\textheight,keepaspectratio]{#1}}

\pagestyle{fancy}
\fancyhf{}
\ifdim\ifspan>0pt \ifsideleft\fancyhfoffset[L]{\ifspan}\else\fancyhfoffset[R]{\ifspan}\fi\fi
\renewcommand{\headrulewidth}{0.35pt}
\renewcommand{\headrule}{{\color{ifrule}\hrule width\headwidth height\headrulewidth}}
\renewcommand{\footrulewidth}{0pt}
\fancyhead[LE]{\ifsans\small\bfseries\thepage}
\fancyhead[RE]{\ifsans\scriptsize\color{ifgray}\textls[110]{INTELLECTUAL FRONTIERS RESEARCH}}
\fancyhead[LO]{\ifsans\scriptsize\color{ifgray}\textls[40]{\paperval{shorttitle}}}
\fancyhead[RO]{\ifsans\small\bfseries\thepage}
\fancyfoot[C]{\ifsans\scriptsize\color{ifgray}Version \paperval{revnumber}\ \textperiodcentered\ \paperval{revdate}}
\fancypagestyle{plain}{%
  \fancyhf{}%
  \renewcommand{\headrulewidth}{0pt}%
  \fancyfoot[L]{\ifsans\scriptsize\color{ifgray}\paperval{copyright}}%
  \fancyfoot[R]{\ifsans\scriptsize\color{ifgray}Version \paperval{revnumber}\ \textperiodcentered\ \paperval{revdate}}%
}

\newtcolorbox{ifkeypoints}{enhanced,sharp corners,colback=white,frame hidden,boxrule=0pt,
  borderline north={1.6pt}{0pt}{ifblue},borderline south={0.4pt}{0pt}{ifrule},
  left=0pt,right=0pt,top=6pt,bottom=3pt,before skip=0pt,after skip=0pt,
  fontupper=\ifsans\fontsize{8.7}{11.3}\selectfont\setlength{\parindent}{0pt},
  before upper={{\ifsans\bfseries\fontsize{7}{8.4}\selectfont\color{ifblue}\textls[110]{KEY POINTS}}\par\vspace{3pt}}}
\newcommand{\keypointitem}[2]{\par\noindent{\bfseries #1}\ #2\par\vspace{3.5pt}}
\newcommand{\paperendnote}{%
  \iftext{license}{\par\vspace{9pt}\noindent{\color{ifrule}\hrule height 0.4pt}\vspace{3pt}
    {\ifsans\fontsize{7.2}{9.2}\selectfont\color{ifgray}\setlength{\parindent}{0pt}
    \paperval{copyright} \href{\paperval{licenseurl}}{\paperval{licenseurl}}.
    The names and marks of Intellectual Frontiers are not licensed under this license.\par}}}
\newcommand{\paperlabel}[1]{{\ifsans\bfseries\fontsize{6.6}{8}\selectfont\color{ifgray}\textls[110]{\MakeUppercase{#1}}}}

\newcommand{\paperheadblock}[1]{%
    \begin{minipage}{\ifwide}
      \raggedright
      {\ifsans\bfseries\fontsize{8.6}{10}\selectfont\color{ifink}\textls[130]{INTELLECTUAL FRONTIERS RESEARCH}}%
      \hfill
      {\ifsans\fontsize{7.6}{9}\selectfont\color{ifgray}\textls[100]{\MakeUppercase{\paperval{tag}}\ \textperiodcentered\ VERSION \paperval{revnumber}}}\par
      \vspace{3pt}{\color{ifink}\hrule height 1.4pt}\vspace{11pt}
      {\raggedright\bfseries\fontsize{21}{24}\selectfont\color{ifink}\paperval{title}\par}
      \iftext{subtitle}{\vspace{6pt}{\itshape\fontsize{12}{14.6}\selectfont\color{ifgray}\paperval{subtitle}\par}}
      \vspace{8pt}
      {\ifsans\fontsize{10.4}{12.6}\selectfont\bfseries\paperval{author}}%
      \iftext{orcid}{\ {\ifsans\fontsize{7.6}{9}\selectfont\color{ifgray}\href{https://orcid.org/\paperval{orcid}}{ORCID \paperval{orcid}}}}\par
      {\ifsans\fontsize{8.6}{11}\selectfont\color{ifgray}\paperval{affiliation}\par}
      \vspace{7pt}{\color{ifrule}\hrule height 0.5pt}\vspace{6pt}
      \begin{minipage}[t]{0.72\ifwide}
        {\ifsans\fontsize{8.8}{11.6}\selectfont\raggedright\setlength{\parindent}{0pt}\setlength{\parskip}{3pt}
        \paperlabel{Abstract}\par\vspace{3pt}#1\par}
      \end{minipage}\hfill
      \begin{minipage}[t]{0.24\ifwide}
        {\ifsans\fontsize{7.8}{10}\selectfont\raggedright
        \paperlabel{Version}\par \paperval{revnumber}\par \paperval{revdate}\par\vspace{5pt}
        \iftext{keywords}{\paperlabel{Keywords}\par {\color{ifgray}\paperval{keywords}}\par}}
      \end{minipage}
      \vspace{6pt}{\color{ifrule}\hrule height 0.5pt}
      \vspace{3pt}{\ifsans\fontsize{7.5}{9.6}\selectfont\color{ifgray}\paperlabel{Cite as}\ \paperval{cite}\par}
      \vspace{4pt}
    \end{minipage}}

\newcommand{\paperbandblock}[2]{%
    \begin{minipage}{\ifwide}
      \vspace{9pt}
      \ifx\relax#1\relax\else
      \begin{minipage}[t]{0.58\ifwide}\vspace{0pt}#1\end{minipage}\hfill
      \begin{minipage}[t]{0.37\ifwide}\vspace{0pt}#2\end{minipage}\par
      \fi
      \vspace{4pt}
    \end{minipage}}

\newcommand{\makepapertitle}[3]{%
  \hypersetup{pdftitle={\paperval{title}},pdfauthor={\paperval{author}},
    pdfkeywords={\paperval{keywords}},pdfsubject={\paperval{subtitle}},
    pdfpublication={Intellectual Frontiers Research},pdfpublisher={Intellectual Frontiers},
    pdfcopyright={\paperval{copyright}},pdflicenseurl={\paperval{licenseurl}}}%
  \ififsingle\par\noindent\begin{ifspanning}\paperheadblock{#1}\end{ifspanning}\par\vspace{9pt}\begin{ifspanning}\paperbandblock{#2}{#3}\end{ifspanning}\par\vspace{6pt}\else\twocolumn[{\paperheadblock{#1}\par\vspace{9pt}\paperbandblock{#2}{#3}}]\fi%
  \thispagestyle{plain}%
}
