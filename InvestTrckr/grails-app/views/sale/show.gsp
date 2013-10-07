
<%@ page import="investtrckr.Sale" %>
<!DOCTYPE html>
<html>
	<head>
		<meta name="layout" content="main">
		<g:set var="entityName" value="${message(code: 'sale.label', default: 'Sale')}" />
		<title><g:message code="default.show.label" args="[entityName]" /></title>
	</head>
	<body>
		<a href="#show-sale" class="skip" tabindex="-1"><g:message code="default.link.skip.label" default="Skip to content&hellip;"/></a>
		<div class="nav" role="navigation">
			<ul>
				<li><a class="home" href="${createLink(uri: '/')}"><g:message code="default.home.label"/></a></li>
				<li><g:link class="list" action="list"><g:message code="default.list.label" args="[entityName]" /></g:link></li>
				<li><g:link class="create" action="create"><g:message code="default.new.label" args="[entityName]" /></g:link></li>
			</ul>
		</div>
		<div id="show-sale" class="content scaffold-show" role="main">
			<h1><g:message code="default.show.label" args="[entityName]" /></h1>
			<g:if test="${flash.message}">
			<div class="message" role="status">${flash.message}</div>
			</g:if>
			<ol class="property-list sale">
			
				<g:if test="${saleInstance?.date}">
				<li class="fieldcontain">
					<span id="date-label" class="property-label"><g:message code="sale.date.label" default="Date" /></span>
					
						<span class="property-value" aria-labelledby="date-label"><g:formatDate date="${saleInstance?.date}" /></span>
					
				</li>
				</g:if>
			
				<g:if test="${saleInstance?.price}">
				<li class="fieldcontain">
					<span id="price-label" class="property-label"><g:message code="sale.price.label" default="Price" /></span>
					
						<span class="property-value" aria-labelledby="price-label"><g:fieldValue bean="${saleInstance}" field="price"/></span>
					
				</li>
				</g:if>
			
				<g:if test="${saleInstance?.quantity}">
				<li class="fieldcontain">
					<span id="quantity-label" class="property-label"><g:message code="sale.quantity.label" default="Quantity" /></span>
					
						<span class="property-value" aria-labelledby="quantity-label"><g:fieldValue bean="${saleInstance}" field="quantity"/></span>
					
				</li>
				</g:if>
			
				<g:if test="${saleInstance?.investment}">
				<li class="fieldcontain">
					<span id="investment-label" class="property-label"><g:message code="sale.investment.label" default="Investment" /></span>
					
						<span class="property-value" aria-labelledby="investment-label"><g:link controller="investment" action="show" id="${saleInstance?.investment?.id}">${saleInstance?.investment?.encodeAsHTML()}</g:link></span>
					
				</li>
				</g:if>
			
			</ol>
			<g:form>
				<fieldset class="buttons">
					<g:hiddenField name="id" value="${saleInstance?.id}" />
					<g:link class="edit" action="edit" id="${saleInstance?.id}"><g:message code="default.button.edit.label" default="Edit" /></g:link>
					<g:actionSubmit class="delete" action="delete" value="${message(code: 'default.button.delete.label', default: 'Delete')}" onclick="return confirm('${message(code: 'default.button.delete.confirm.message', default: 'Are you sure?')}');" />
				</fieldset>
			</g:form>
		</div>
	</body>
</html>
