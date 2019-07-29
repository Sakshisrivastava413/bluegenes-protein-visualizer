import React from 'react';
import pv from 'bio-pv';
import Loading from './Loading';
import queryGeneToProtein from './queries/geneToProtein';
import queryAccessionToPdb from './queries/accessionToPdb';

class RootContainer extends React.Component {
	constructor(props) {
		super(props);
		this.visualizer = React.createRef();
		this.state = {
			structureReady: true,
			pdbIds: null,
			filteredPdbIds: null,
			selectedId: 0,
			viewerMode: 'cartoon',
			error: null,
			searchedId: '',
			hoveredId: null
		};
		this.initVisualizer = this.initVisualizer.bind(this);
		this.handleSearch = this.handleSearch.bind(this);
		this.fetchTitle = this.fetchTitle.bind(this);
	}

	componentDidMount() {
		const {
			entity: { value: geneId },
			serviceUrl,
			testing
		} = this.props;

		// if mode is `testing` don't do cals
		if (testing) return;

		this.setState({ structureReady: false });
		queryGeneToProtein(geneId, serviceUrl)
			.then(res => {
				const { proteins } = res;
				queryAccessionToPdb(proteins[0].primaryAccession)
					.then(ids => {
						this.setState({
							pdbIds: ids,
							filteredPdbIds: ids
						});
						this.initVisualizer(ids);
						this.fetchTitle(ids[0]);
					})
					.catch(error => {
						error =
							typeof error === 'string'
								? error
								: 'Could not download PDB file, please try again later!';
						this.setState({ error });
					});
			})
			.catch(error => this.setState({ error }));
	}

	initVisualizer(ids, selectedId) {
		if (!ids) ids = this.state.pdbIds;
		if (!selectedId) selectedId = this.state.selectedId;
		pv.io.fetchPdb(
			`https://files.rcsb.org/download/${ids[selectedId]}.pdb`,
			structure => {
				this.setState({ structureReady: true }, () => {
					// remove all current HTML from main element
					// initialise protein visualizer with default init options
					this.visualizer.current.innerHTML = '';
					const viewer = pv.Viewer(this.visualizer.current, {
						quality: 'medium',
						antialias: true,
						outline: false,
						slabMode: 'auto'
					});

					const go = viewer.renderAs(
						'structure',
						structure,
						this.state.viewerMode,
						{
							color: pv.color.ssSuccession(),
							showRelated: '1'
						}
					);

					// find camera orientation such that the molecules biggest extents are
					// aligned to the screen plane.
					const rotation = pv.viewpoint.principalAxes(go);
					viewer.setRotation(rotation);

					// adapt zoom level to contain the whole structure
					viewer.autoZoom();
				});
			}
		);
	}

	updateSelected(idIndex) {
		this.setState({
			selectedId: idIndex,
			focusedIdTitle: '',
			detailsLoading: true
		});

		// fetch title for the `id` clicked
		const id = this.state.filteredPdbIds[idIndex];
		this.fetchTitle(id);

		this.visualizer.current.innerHTML = '';
		this.setState({ structureReady: false });
		this.initVisualizer(null, idIndex);
	}

	fetchTitle(id) {
		fetch(`https://www.rcsb.org/pdb/json/describePDB?structureId=${id}`)
			.then(res => res.json())
			.then(res =>
				this.setState({
					detailsLoading: false,
					focusedIdTitle: res[0].title
				})
			);
	}

	changeMode(ev) {
		this.setState({ viewerMode: ev.target.value }, () => {
			this.visualizer.current.innerHTML = '';
			this.setState({ structureReady: false });
			this.initVisualizer();
		});
	}

	handleSearch(ev) {
		const { value } = ev.target;
		this.setState(
			{
				filteredPdbIds: this.state.pdbIds.filter(
					id => id.toLowerCase().indexOf(value.toLowerCase()) !== -1
				)
			},
			() => this.fetchTitle(this.state.filteredPdbIds[0])
		);
	}

	render() {
		const PdbIdList =
			this.state.filteredPdbIds &&
			this.state.filteredPdbIds.map((id, i) => (
				<div key={i}>
					<div
						className={`option ${this.state.selectedId == i && 'selected'}`}
						onClick={() => this.updateSelected(i)}
					>
						{id}
					</div>
					{this.state.selectedId === i && (
						<div className="details-panel">
							{this.state.detailsLoading ? (
								<Loading />
							) : (
								<>
									<h3>{this.state.focusedIdTitle}</h3>
									<a
										href={`https://www.rcsb.org/structure/${id}`}
										rel="noopener noreferrer"
										target="_blank"
										className="title-text"
									>
										open RCSB page
									</a>
								</>
							)}
						</div>
					)}
				</div>
			));

		const ViewerModes = [
			'sline',
			'lines',
			'trace',
			'lineTrace',
			'cartoon',
			'tube',
			'spheres'
		].map(m => (
			<option key={m} value={m}>
				{m}
			</option>
		));

		if (this.state.error)
			return <div className="viz-container error">{this.state.error}</div>;

		if (!PdbIdList)
			return (
				<div className="rootContainer">
					<Loading text="Fetching associated PDB ids" />
				</div>
			);

		return (
			<div className="rootContainer">
				{this.state.structureReady ? (
					<div className="viz-container" ref={this.visualizer} />
				) : (
					<div className="viz-container">
						<Loading text="Initialising Visualizer..." />
					</div>
				)}
				<div className="select-box">
					<span className="heading">Select Viewer Mode</span>
					<select
						placeholder="Select viewer mode"
						className="viewer-select"
						onChange={this.changeMode.bind(this)}
					>
						{ViewerModes}
					</select>
					<input
						className="heading"
						placeholder="Search and Select a PDB ID"
						onChange={this.handleSearch}
					/>
					<div style={{ maxHeight: 300, overflow: 'scroll' }}>
						{PdbIdList.length ? PdbIdList : 'No search results!'}
					</div>
				</div>
			</div>
		);
	}
}

export default RootContainer;